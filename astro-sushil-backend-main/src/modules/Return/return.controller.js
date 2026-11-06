import puppeteer from "puppeteer";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { Return } from "./return.model.js";
import { Order } from "../Order/order.model.js";
import { Transaction } from "../Transaction/Transaction.model.js";
import {
  requestReturn,
  approveReturn,
  rejectReturn,
  retryReturnShipment,
  updateManualReturnStatus,
  markReturnInspected,
  processReturnRefund,
} from "../Fulfillment/fulfillment.service.js";
import { cancelShiprocketOrders } from "../../service/shiprocket.js";
import { generateCreditNoteTemplate } from "../../utils/creditNote.template.js";
import { logActivity } from "../AuditLog/auditLog.service.js";
import {
  ensureSequenceNumber,
  formatInvoiceNumber,
  formatCreditNoteNumber,
} from "../../utils/invoiceSequence.js";

// ─── Credit note (shared by customer + admin download routes) ─────────────

// Return.items[] carries no price/tax — those live on the matching
// Order.items[] line, exactly as processReturnRefund itself joins them to
// compute refundAmount (fulfillment.service.js). Re-derives that same
// per-unit tax split here rather than trusting a persisted total, so the
// credit note's line-by-line breakdown always matches the order it's
// issued against.
function buildCreditNoteItems(returnDoc, order) {
  const round2 = (n) => Math.round(n * 100) / 100;

  return returnDoc.items.map((retItem) => {
    // Prefer the exact line (retItem.orderItemId) — matching by product id
    // alone always resolved to whichever line came first, showing the
    // wrong variant's price on the credit note whenever an order had two
    // lines for the same product with different selections.
    const orderItem =
      (retItem.orderItemId &&
        order.items.find((oi) => oi._id && String(oi._id) === String(retItem.orderItemId))) ||
      order.items.find((oi) => String(oi.product?._id || oi.product) === String(retItem.product));

    const price = orderItem?.price || 0;
    const unitTax = orderItem?.quantity ? (orderItem.taxAmount || 0) / orderItem.quantity : 0;
    const quantity = retItem.quantity || 0;

    return {
      name: retItem.name || orderItem?.name || "—",
      quantity,
      price,
      taxRate: orderItem?.taxRate || 0,
      taxAmount: round2(unitTax * quantity),
      lineTotal: round2(price * quantity),
    };
  });
}

async function renderCreditNotePdf(returnDoc) {
  if (returnDoc.status !== "refunded") {
    throw new ApiError(400, "Credit note is only available once the refund has been processed");
  }

  const order = await Order.findById(returnDoc.order);
  if (!order) throw new ApiError(404, "Order not found");

  // The credit note references the same invoice number as the order it's
  // issued against, so both documents agree — and gets its own separate
  // CN-series number the first time this specific credit note is opened.
  await ensureSequenceNumber(Order, order, {
    field: "invoiceNumber",
    counterKey: "invoice",
    formatter: formatInvoiceNumber,
  });
  await ensureSequenceNumber(Return, returnDoc, {
    field: "creditNoteNumber",
    counterKey: "creditNote",
    formatter: formatCreditNoteNumber,
  });

  const transaction = returnDoc.refundTransactionId
    ? await Transaction.findById(returnDoc.refundTransactionId).lean()
    : null;

  const html = generateCreditNoteTemplate({
    returnDoc,
    order,
    transaction,
    items: buildCreditNoteItems(returnDoc, order),
  });

  const browser = await puppeteer.connect({
    browserWSEndpoint: process.env.PDF_SERVER,
  });

  let pdfBuffer;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }

  if (!pdfBuffer || pdfBuffer.length < 1000) {
    throw new Error("PDF generation failed");
  }

  return pdfBuffer;
}

// ─── Customer ───────────────────────────────────────────────────────────────

export const createReturnRequest = asyncHandler(async (req, res) => {
  const { items, reason, customerComment } = req.body;

  if (!Array.isArray(items) || !items.length) {
    throw new ApiError(400, "At least one item is required");
  }

  const returnEntry = await requestReturn(req.params.orderId, req.user._id, {
    items,
    reason,
    customerComment,
  });

  res.status(201).json(new ApiResponse(201, returnEntry, "Return requested"));
});

export const downloadCreditNote = asyncHandler(async (req, res) => {
  const { orderId, returnId } = req.params;

  const order = await Order.findOne({ _id: orderId, user: req.user._id }).select("_id");
  if (!order) throw new ApiError(404, "Order not found");

  const returnDoc = await Return.findOne({ _id: returnId, order: orderId });
  if (!returnDoc) throw new ApiError(404, "Return not found");

  const pdfBuffer = await renderCreditNotePdf(returnDoc);

  res.setHeader("Content-Type", "application/pdf");
  // Never let the browser reuse a cached response for this URL — see the
  // matching comment in order.controller.js's downloadInvoice.
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", `attachment; filename=credit-note-${returnId}.pdf`);
  return res.end(pdfBuffer);
});

// ─── Admin ──────────────────────────────────────────────────────────────────

/**
 * Flat, paginated view of every return across every order — now a plain
 * query against the Return collection (was a $unwind aggregation over
 * every Order). Response shape ({orderId, userName, userEmail, return})
 * is preserved so the admin frontend needed only a URL change.
 */
export const getAllReturns = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Number(req.query.limit) || 10);
  const { status } = req.query;

  const filter = status ? { status } : {};

  const [returns, total] = await Promise.all([
    Return.find(filter)
      .sort({ requestedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: "order", select: "user", populate: { path: "user", select: "firstName email" } })
      .lean(),
    Return.countDocuments(filter),
  ]);

  const data = returns.map(({ order, ...returnEntry }) => ({
    orderId: order?._id,
    userName: order?.user?.firstName,
    userEmail: order?.user?.email,
    return: returnEntry,
  }));

  res.json(new ApiResponse(200, data, "Returns fetched", { total, page, limit }));
});

export const getOrderReturns = asyncHandler(async (req, res) => {
  const returns = await Return.find({ order: req.params.orderId }).sort({ requestedAt: -1 }).lean();
  res.json(new ApiResponse(200, returns, "Returns fetched"));
});

export const getReturnById = asyncHandler(async (req, res) => {
  const returnEntry = await Return.findById(req.params.returnId).lean();
  if (!returnEntry) throw new ApiError(404, "Return not found");

  res.json(new ApiResponse(200, returnEntry, "Return fetched"));
});

export const approveReturnHandler = asyncHandler(async (req, res) => {
  const returnEntry = await approveReturn(req.params.returnId);

  await logActivity({
    admin: req.user,
    action: "return.approve",
    targetType: "Return",
    targetId: returnEntry._id,
    targetLabel: `#${String(returnEntry._id).slice(-8).toUpperCase()}`,
    changes: [],
  });

  res.json(new ApiResponse(200, returnEntry, "Return approved"));
});

export const rejectReturnHandler = asyncHandler(async (req, res) => {
  const returnEntry = await rejectReturn(req.params.returnId, {
    notes: req.body?.notes,
  });

  await logActivity({
    admin: req.user,
    action: "return.reject",
    targetType: "Return",
    targetId: returnEntry._id,
    targetLabel: `#${String(returnEntry._id).slice(-8).toUpperCase()}`,
    changes: [],
  });

  res.json(new ApiResponse(200, returnEntry, "Return rejected"));
});

export const retryReturnHandler = asyncHandler(async (req, res) => {
  const returnEntry = await retryReturnShipment(req.params.returnId);

  await logActivity({
    admin: req.user,
    action: "return.retry_shipment",
    targetType: "Return",
    targetId: returnEntry._id,
    targetLabel: `#${String(returnEntry._id).slice(-8).toUpperCase()}`,
    changes: [],
  });

  res.json(new ApiResponse(200, returnEntry, "Return shipment retried"));
});

export const updateManualReturnHandler = asyncHandler(async (req, res) => {
  const { status, awb, courier, trackingUrl, notes } = req.body;
  const returnEntry = await updateManualReturnStatus(req.params.returnId, {
    status,
    awb,
    courier,
    trackingUrl,
    notes,
  });

  await logActivity({
    admin: req.user,
    action: "return.manual_status_update",
    targetType: "Return",
    targetId: returnEntry._id,
    targetLabel: `#${String(returnEntry._id).slice(-8).toUpperCase()}`,
    changes: status ? [{ field: "status", from: null, to: status }] : [],
  });

  res.json(new ApiResponse(200, returnEntry, "Return updated"));
});

export const inspectReturnHandler = asyncHandler(async (req, res) => {
  const { passed, notes } = req.body;

  const returnEntry = await markReturnInspected(req.params.returnId, {
    passed,
    notes,
    adminId: req.user._id,
  });

  await logActivity({
    admin: req.user,
    action: "return.inspect",
    targetType: "Return",
    targetId: returnEntry._id,
    targetLabel: `#${String(returnEntry._id).slice(-8).toUpperCase()}`,
    changes: [],
  });

  res.json(new ApiResponse(200, returnEntry, "Inspection recorded"));
});

export const refundReturnHandler = asyncHandler(async (req, res) => {
  const returnEntry = await processReturnRefund(req.params.returnId, {
    adminId: req.user._id,
    notes: req.body?.notes,
  });

  await logActivity({
    admin: req.user,
    action: "return.refund",
    targetType: "Return",
    targetId: returnEntry._id,
    targetLabel: `#${String(returnEntry._id).slice(-8).toUpperCase()}`,
    changes: [],
  });

  res.json(new ApiResponse(200, returnEntry, "Refund processed"));
});

export const cancelReturnPickupHandler = asyncHandler(async (req, res) => {
  const returnEntry = await Return.findById(req.params.returnId);
  if (!returnEntry) throw new ApiError(404, "Return not found");
  if (!returnEntry.shiprocketReturnOrderId) {
    throw new ApiError(400, "This return has no Shiprocket reverse pickup to cancel");
  }

  // Only meaningful before the item is actually back and inspected — this
  // used to only check that a Shiprocket order id existed, which let it
  // fire on a "received"/"approved_for_refund" return too: the warehouse
  // already has the item and (if inspection passed) it's already been
  // restocked, so "cancelling the pickup" at that point silently killed the
  // refund with no way to reopen it. Once past this point, reject/refund
  // are the only valid next moves.
  if (!["approved", "pickup_scheduled", "picked_up", "in_transit"].includes(returnEntry.status)) {
    throw new ApiError(
      400,
      `Cannot cancel the reverse pickup for a return in status "${returnEntry.status}"`,
    );
  }

  await cancelShiprocketOrders([returnEntry.shiprocketReturnOrderId]);

  // Delegates to rejectReturn for the actual state transition so the
  // returnedQuantity release logic lives in exactly one place.
  const updated = await rejectReturn(req.params.returnId, {
    notes: "Reverse pickup cancelled by admin",
  });

  await logActivity({
    admin: req.user,
    action: "return.cancel_pickup",
    targetType: "Return",
    targetId: updated._id,
    targetLabel: `#${String(updated._id).slice(-8).toUpperCase()}`,
    changes: [],
  });

  res.json(new ApiResponse(200, updated, "Reverse pickup cancelled"));
});

export const downloadCreditNoteAdmin = asyncHandler(async (req, res) => {
  const { returnId } = req.params;

  const returnDoc = await Return.findById(returnId);
  if (!returnDoc) throw new ApiError(404, "Return not found");

  const pdfBuffer = await renderCreditNotePdf(returnDoc);

  res.setHeader("Content-Type", "application/pdf");
  // Never let the browser reuse a cached response for this URL — see the
  // matching comment in order.controller.js's downloadInvoice.
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", `attachment; filename=credit-note-${returnId}.pdf`);
  return res.end(pdfBuffer);
});
