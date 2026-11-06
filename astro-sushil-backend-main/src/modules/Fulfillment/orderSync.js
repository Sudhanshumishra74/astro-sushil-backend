// Keeps Order.shipments[]/Order.returns[] as a full, denormalized mirror of
// the canonical Shipment/Return collections — so the admin order-detail
// screen never needs a second API call to show shipment/return info.
//
// These helpers are pure/in-memory only (no DB writes of their own): every
// call site already loads the `order` document and calls `order.save()`
// itself, so mutating the array here and letting that existing save persist
// it avoids a second write racing with the first. syncShipmentSummary is the
// one exception — see its own comment below.

import { Transaction } from "../Transaction/Transaction.model.js";

function shipmentToSummary(shipment) {
  return {
    shipmentId: shipment._id,
    fulfillmentType: shipment.fulfillmentType,
    items: shipment.items,
    shiprocketOrderId: shipment.shiprocketOrderId,
    shiprocketShipmentId: shipment.shiprocketShipmentId,
    courier: shipment.courier,
    awb: shipment.awb,
    trackingUrl: shipment.trackingUrl,
    labelUrl: shipment.labelUrl,
    edd: shipment.edd,
    courierCharge: shipment.courierCharge,
    status: shipment.status,
    statusCode: shipment.statusCode,
    statusHistory: shipment.statusHistory,
    error: shipment.error,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
  };
}

function returnToSummary(returnDoc) {
  return {
    returnId: returnDoc._id,
    fulfillmentType: returnDoc.fulfillmentType,
    originShipmentId: returnDoc.originShipmentId,
    items: returnDoc.items,
    reason: returnDoc.reason,
    customerComment: returnDoc.customerComment,
    shiprocketReturnOrderId: returnDoc.shiprocketReturnOrderId,
    shiprocketReturnShipmentId: returnDoc.shiprocketReturnShipmentId,
    courier: returnDoc.courier,
    awb: returnDoc.awb,
    trackingUrl: returnDoc.trackingUrl,
    status: returnDoc.status,
    statusCode: returnDoc.statusCode,
    statusHistory: returnDoc.statusHistory,
    inspection: returnDoc.inspection,
    refundAmount: returnDoc.refundAmount,
    refundIncludesShipping: returnDoc.refundIncludesShipping,
    refundTransactionId: returnDoc.refundTransactionId,
    razorpayRefundId: returnDoc.razorpayRefundId,
    refundMethod: returnDoc.refundMethod,
    refundedAt: returnDoc.refundedAt,
    adminNote: returnDoc.adminNote,
    error: returnDoc.error,
    requestedAt: returnDoc.requestedAt,
    receivedAt: returnDoc.receivedAt,
    createdAt: returnDoc.createdAt,
    updatedAt: returnDoc.updatedAt,
  };
}

function upsert(array, idField, id, summary) {
  const idx = array.findIndex((entry) => String(entry[idField]) === String(id));
  if (idx === -1) array.push(summary);
  else array.splice(idx, 1, summary);
}

// A shipment reaching one of these means that leg is done — Shiprocket's
// own "delivered"/webhook-driven statuses.
const DELIVERED_STATUSES = new Set(["delivered", "fulfilled", "self_fulfilled"]);

// Anything courier-in-motion.
const PROGRESS_STATUSES = new Set([
  "shipped",
  "out_for_delivery",
  "in_transit",
  "picked_up",
  "pickup_scheduled",
]);

// Everything else (pending/awaiting_manual_fulfillment/processing, plus any
// RTO/lost/cancelled/failed shipment status) deliberately contributes
// nothing here — a stuck or failed leg should never force-advance *or*
// block the order status; it's left to the admin's manual override.
const ORDER_STATUS_RANK = { placed: 0, confirmed: 0, processing: 1, shipped: 2, delivered: 3 };

// Order-level lifecycle states that shipment progress must never touch.
const ORDER_STATUS_LOCKED = new Set(["payment_pending", "payment_failed", "cancelled"]);

// Keeps `order.orderStatus` honest against `order.shipments[]` — called
// from every site that already calls syncShipmentSummary (Shiprocket's
// webhook/cron-driven updates), so everything stays in sync through the
// same single path. Forward-only: never downgrades a status, so a
// stale/duplicate update can never revert a deliberate manual correction.
// Doesn't enqueue any
// notification itself — the shipment-level update that triggered this call
// already enqueues its own customer notification; duplicating it here would
// double-send.
// Returns true only when this call is what just pushed the order into
// "delivered" (never true on a call that finds it already there, since rank
// only ever increases and "delivered" is the top rank) — syncShipmentSummary
// uses this to know when a COD order's cash was actually just collected.
export function deriveOrderStatus(order) {
  if (order.orderType !== "physical" || !order.shipments?.length) return false;
  if (ORDER_STATUS_LOCKED.has(order.orderStatus)) return false;

  const allDelivered = order.shipments.every((s) => DELIVERED_STATUSES.has(s.status));
  const anyInProgress = order.shipments.some(
    (s) => PROGRESS_STATUSES.has(s.status) || DELIVERED_STATUSES.has(s.status),
  );

  const target = allDelivered ? "delivered" : anyInProgress ? "shipped" : "processing";

  if (ORDER_STATUS_RANK[target] > (ORDER_STATUS_RANK[order.orderStatus] ?? 0)) {
    order.orderStatus = target;
    return target === "delivered";
  }

  return false;
}

// COD's payment is only real once the courier actually collects cash on
// delivery — createOrder deliberately leaves a fresh COD order's
// payment.status/Transaction at "pending" rather than marking it "paid" the
// instant the order was placed (the old behavior counted un-collected,
// possibly-never-collected cash as revenue on the admin dashboard, and a COD
// order cancelled before delivery stayed "paid" forever since cancelOrder
// never touches payment.status). Called from both syncShipmentSummary
// (shipment-tracking-driven delivery) and updateOrderStatus (an admin
// manually marking the order "delivered" from the dropdown, bypassing
// shipment tracking entirely) — the two places an order can actually reach
// "delivered". Mirrors verifyPayment's Razorpay claim, and is the one
// deliberate exception to this file's "no DB writes of its own" rule, since
// a Transaction document lives outside `order` and can't be persisted
// through the caller's own order.save().
export async function finalizeCodPayment(order) {
  if (order.payment?.method !== "cod" || order.payment.status === "paid") return;

  order.payment.status = "paid";
  await Transaction.findOneAndUpdate(
    { order: order._id, transactionType: "order" },
    { $set: { status: "success" } },
  );
}

export async function syncShipmentSummary(order, shipment) {
  upsert(order.shipments, "shipmentId", shipment._id, shipmentToSummary(shipment));

  const justDelivered = deriveOrderStatus(order);
  if (justDelivered) {
    await finalizeCodPayment(order);
  }
}

export function syncReturnSummary(order, returnDoc) {
  upsert(order.returns, "returnId", returnDoc._id, returnToSummary(returnDoc));
}

export { shipmentToSummary, returnToSummary };
