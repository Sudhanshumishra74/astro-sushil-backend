import mongoose from "mongoose";
import { Order } from "../Order/order.model.js";
import { Shipment } from "../Shipment/shipment.model.js";
import { Return } from "../Return/return.model.js";
import { User } from "../auth/user.modal.js";
import { Product } from "../products/product.modal.js";
import { Transaction } from "../Transaction/Transaction.model.js";
import Setting from "../Setting/Setting.model.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  createShiprocketOrder,
  getShippingRates,
  assignAWB,
  generatePickup,
  generateShippingLabel,
  buildTrackingUrl,
  createReturnPickup,
  isAlreadyInPickupQueueError,
  cancelShiprocketOrders,
} from "../../service/shiprocket.js";
import { getShiprocketConfig } from "../../config/shiprocket.js";
import { refundRazorpayPayment } from "../../utils/razorpay.js";
import { notifyReturnStatus } from "../shiprocket/shiprocketNotify.js";
import { notificationQueue } from "../../queues/notification.queue.js";
import { syncShipmentSummary, syncReturnSummary } from "./orderSync.js";
import { estimatePackage } from "./packaging.js";
import logger from "../../utils/logger.js";

// Derives fulfillment routing from data that already exists on the product
// — no new Product fields. See the plan: fulfillment type is a live
// product-level fact, not something worth snapshotting onto the order item.
function getFulfillmentType(product) {
  if (!product) return "self"; // safest fallback if the product was later deleted
  if (product.type === "digital") return "digital";
  return "self";
}

function toShipmentItems(items) {
  return items.map((item) => ({
    product: item.product?._id || item.product,
    name: item.name,
    quantity: item.quantity,
    sku: item.product?.sku || null,
    variantName: item.variantName || null,
    variantValue: item.variantValue || null,
    subVariantName: item.subVariantName || null,
    subVariantValue: item.subVariantValue || null,
    selectedRatti: item.selectedRatti || null,
  }));
}

function buildShiprocketOrderPayload(order, user, selfItems, pkg, config) {
  const address = order.shippingAddress || {};

  return {
    order_id: String(order._id),
    order_date: new Date(order.createdAt || Date.now()).toISOString().slice(0, 19).replace("T", " "),
    pickup_location: config.pickupLocation,
    billing_customer_name: address.fullName || "Customer",
    billing_last_name: "",
    billing_address: address.addressLine1 || "",
    billing_address_2: address.addressLine2 || "",
    billing_city: address.city || "",
    billing_pincode: address.pincode || "",
    billing_state: address.state || "",
    billing_country: "India",
    billing_email: user?.email || "",
    billing_phone: address.phone || "",
    shipping_is_billing: true,
    order_items: selfItems.map((item) => ({
      name: item.name,
      sku: item.product?.sku || String(item.product?._id || item.product),
      units: item.quantity,
      selling_price: item.price,
      discount: computeLineDiscount(order, item),
      tax: item.taxAmount || 0,
    })),
    payment_method: order.payment?.method === "cod" ? "COD" : "Prepaid",
    sub_total: selfItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    length: pkg.dims.length,
    breadth: pkg.dims.width,
    height: pkg.dims.height,
    weight: pkg.weight,
  };
}

// Creates the Shiprocket order, then best-effort continues through courier
// selection -> AWB -> pickup scheduling. Each step is independently
// try/caught: if AWB assignment fails after the order was created, the
// shipment record still saves with whatever succeeded (`shiprocketOrderId`
// present, `awb` absent) plus an `error` note, so the admin retry endpoint
// has something concrete to resume from rather than starting over blind.
async function createSelfShipment(order, user, selfItems) {
  const pkg = estimatePackage(selfItems);
  const config = await getShiprocketConfig();
  const shipment = {
    fulfillmentType: "self",
    items: toShipmentItems(selfItems),
    status: "pending",
  };

  let shiprocketOrder;
  try {
    shiprocketOrder = await createShiprocketOrder(
      buildShiprocketOrderPayload(order, user, selfItems, pkg, config),
    );
  } catch (err) {
    logger.error(`[fulfillment] Shiprocket order creation failed for order ${order._id}: ${err.message}`);
    return { ...shipment, error: err.message };
  }

  shipment.shiprocketOrderId = shiprocketOrder?.order_id ? String(shiprocketOrder.order_id) : null;
  shipment.shiprocketShipmentId = shiprocketOrder?.shipment_id ? String(shiprocketOrder.shipment_id) : null;

  if (!shipment.shiprocketShipmentId) {
    shipment.error = "Shiprocket order created but no shipment_id returned";
    return shipment;
  }

  try {
    const rates = await getShippingRates({
      pickupPincode: config.pickupPincode,
      deliveryPincode: order.shippingAddress?.pincode,
      weightKg: pkg.weight,
      cod: order.payment?.method === "cod" ? 1 : 0,
    });

    const cheapest = [...rates].sort((a, b) => Number(a.rate) - Number(b.rate))[0];
    if (!cheapest) {
      shipment.error = "No courier serviceable for this route";
      return shipment;
    }

    // Field name unverified against a live Shiprocket response (same
    // caveat as trackShipmentByAWB's statusCode/edd handling in
    // shiprocket.js) — the serviceability response is commonly documented
    // to carry this as `etd`, but older/alt account configs have used
    // `estimated_delivery_days`; try both rather than assuming one.
    shipment.edd = cheapest.etd || cheapest.estimated_delivery_days || null;

    // What Shiprocket actually bills for this courier — distinct from
    // whatever the customer was charged at checkout (order.selfShippingAmount),
    // which may be a flat fallback, a stale quote, or waived by a promo.
    const rate = Number(cheapest.rate);
    shipment.courierCharge = Number.isFinite(rate) ? rate : null;

    const awbResult = await assignAWB(shipment.shiprocketShipmentId, cheapest.courier_company_id);
    const awbData = awbResult?.response?.data;

    shipment.awb = awbData?.awb_code || null;
    shipment.courier = awbData?.courier_name || cheapest.courier_name || null;
    shipment.trackingUrl = buildTrackingUrl(shipment.awb);

    if (shipment.awb) {
      try {
        await generatePickup([shipment.shiprocketShipmentId]);
      } catch (err) {
        if (isAlreadyInPickupQueueError(err)) {
          // A prior attempt already scheduled this — most likely an admin
          // retrying a shipment that has an AWB but still shows "pending"
          // because nothing else moved it forward (status is otherwise only
          // ever set by the Shiprocket webhook/cron, not by this flow). The
          // desired end-state already holds, so this isn't a real failure.
          logger.info(
            `[fulfillment] Pickup already queued for order ${order._id}, shipment ${shipment.shiprocketShipmentId} — treating as scheduled`,
          );
        } else {
          logger.error(`[fulfillment] Pickup scheduling failed for order ${order._id}: ${err.message}`);
          shipment.error = `Pickup scheduling failed: ${err.message}`;
        }
      }

      // Label generation failing shouldn't clobber a pickup-scheduling
      // error above (or block shipment creation) — it's independently
      // retryable via the admin "Generate Label" action, so just log and
      // move on rather than overwriting `shipment.error`.
      try {
        const labelResult = await generateShippingLabel([shipment.shiprocketShipmentId]);
        shipment.labelUrl = labelResult?.label_url || null;
      } catch (err) {
        logger.error(`[fulfillment] Label generation failed for order ${order._id}: ${err.message}`);
      }
    }
  } catch (err) {
    logger.error(`[fulfillment] Courier/AWB assignment failed for order ${order._id}: ${err.message}`);
    shipment.error = `Courier/AWB assignment failed: ${err.message}`;
  }

  return shipment;
}

/**
 * Processes a just-paid/confirmed order: splits items by fulfillment type
 * and creates the appropriate Shipment document(s). Idempotent — if
 * `order.shipments` is already populated, does nothing (safe to call from
 * multiple post-payment hook sites without double-booking a Shiprocket
 * order). Digital items are intentionally untouched — they're already
 * delivered via `createDownloadsFromOrder` (src/modules/Download).
 *
 * Never throws — a Shiprocket outage must not block order confirmation.
 * Callers still wrap this in try/catch per the existing post-payment
 * side-effect convention, but this function also catches internally so a
 * partial failure still saves whatever shipments did succeed rather than
 * losing all of them.
 */
export async function processFulfillment(orderId) {
  const order = await Order.findById(orderId).populate(
    "items.product",
    "type name sku weight dimensions variants",
  );

  if (!order) return null;
  if (order.shipments?.length) return order; // already processed

  const selfItems = [];

  for (const item of order.items) {
    const fulfillmentType = getFulfillmentType(item.product);
    if (fulfillmentType === "self") selfItems.push(item);
    // "digital" — nothing to do here
  }

  if (!selfItems.length) return order;

  const user = await User.findById(order.user).select("email").lean();

  const shipmentDoc = await Shipment.create({
    order: order._id,
    ...(await createSelfShipment(order, user, selfItems)),
  });
  await syncShipmentSummary(order, shipmentDoc);

  await order.save();
  return order;
}

/**
 * Re-runs shipment creation for one existing Shipment document — used by
 * the admin "retry" endpoint when a Shiprocket call failed the first time.
 * Re-derives the full order-item data (price/quantity/tax) for whatever
 * products that shipment covers, re-creates it the same way
 * `processFulfillment` did originally, and overwrites the existing document
 * in place (same _id).
 */
export async function retryShipment(shipmentId) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new ApiError(404, "Shipment not found");

  const order = await Order.findById(shipment.order).populate(
    "items.product",
    "type name sku weight dimensions variants",
  );
  if (!order) throw new ApiError(404, "Order not found");

  const productIds = new Set(shipment.items.map((i) => String(i.product)));
  const matchingOrderItems = order.items.filter((item) =>
    productIds.has(String(item.product?._id || item.product)),
  );

  if (!matchingOrderItems.length) {
    throw new ApiError(400, "Could not match this shipment back to any current order item");
  }

  const user = await User.findById(order.user).select("email").lean();

  const rebuilt = await createSelfShipment(order, user, matchingOrderItems);

  // Preserve identity/history, overwrite everything else with the fresh attempt.
  const { _id, statusHistory } = shipment;
  Object.assign(shipment, rebuilt, { _id, statusHistory });

  await shipment.save();
  await syncShipmentSummary(order, shipment);
  await order.save();

  return shipment;
}

/**
 * On-demand (re)generation of a self-fulfilled shipment's label — covers
 * both "auto-generation failed at creation time" and shipments created
 * before this feature existed (no labelUrl yet). Requires an AWB already
 * assigned; use retryShipment first if the shipment never got that far.
 */
export async function generateLabel(shipmentId) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new ApiError(404, "Shipment not found");
  if (shipment.fulfillmentType !== "self") {
    throw new ApiError(400, "Labels are only available for self-fulfilled shipments");
  }
  if (!shipment.shiprocketShipmentId) {
    throw new ApiError(400, "This shipment has no Shiprocket shipment id yet — retry the shipment first");
  }

  const labelResult = await generateShippingLabel([shipment.shiprocketShipmentId]);
  shipment.labelUrl = labelResult?.label_url || null;

  if (!shipment.labelUrl) {
    throw new ApiError(502, "Shiprocket did not return a label URL");
  }

  await shipment.save();

  const order = await Order.findById(shipment.order);
  if (order) {
    await syncShipmentSummary(order, shipment);
    await order.save();
  }

  return shipment;
}

// A shipment already at one of these means there's nothing left to cancel —
// it's either done (delivered/lost/destroyed) or already cancelled.
const NON_CANCELLABLE_SHIPMENT_STATUSES = new Set([
  "delivered",
  "fulfilled",
  "self_fulfilled",
  "cancelled",
  "lost",
  "destroyed",
]);

/**
 * Cancels every still-in-flight shipment on an order — called right after
 * an order is marked "cancelled" (customer cancelOrder or admin
 * updateOrderStatus) so a cancelled order doesn't leave a courier pickup
 * still scheduled on Shiprocket. Self-fulfilled shipments get a real
 * Shiprocket cancel API call.
 *
 * Best-effort: a Shiprocket API failure is logged, not thrown — the order
 * is cancelled either way, and a shipment stuck un-cancelled needs an
 * admin's attention via its error note, not a blocked cancel request.
 */
export async function cancelShipmentsForOrder(orderId) {
  const shipments = await Shipment.find({ order: orderId });
  const cancellable = shipments.filter((s) => !NON_CANCELLABLE_SHIPMENT_STATUSES.has(s.status));
  if (!cancellable.length) return;

  const order = await Order.findById(orderId);
  if (!order) return;

  const selfShiprocketOrderIds = cancellable
    .filter((s) => s.fulfillmentType === "self" && s.shiprocketOrderId)
    .map((s) => s.shiprocketOrderId);

  if (selfShiprocketOrderIds.length) {
    try {
      await cancelShiprocketOrders(selfShiprocketOrderIds);
    } catch (err) {
      logger.error(
        `[fulfillment] Shiprocket cancel failed for order ${orderId} (orders ${selfShiprocketOrderIds.join(", ")}): ${err.message}`,
      );
    }
  }

  for (const shipment of cancellable) {
    shipment.status = "cancelled";
    shipment.statusHistory.push({ code: null, status: "cancelled", at: new Date() });

    await shipment.save();
    await syncShipmentSummary(order, shipment);
  }

  await order.save();
}

// Order status → shipment status equivalents, for syncShipmentsToOrderStatus
// below. Only these three have a real shipment-side meaning — "placed"/
// "confirmed" happen before any shipment exists, and "cancelled" already has
// its own dedicated path (cancelShipmentsForOrder).
const ORDER_STATUS_TO_SHIPMENT_STATUS = {
  processing: "processing",
  shipped: "shipped",
  delivered: "delivered",
};

// Ranks shipment statuses the same way orderSync.js ranks order statuses, so
// a manual sync (below) never regresses a shipment that's already further
// along per real courier data. "undelivered" is a failed *attempt* the
// courier will retry, not a dead end — it's deliberately excluded from
// SHIPROCKET_TERMINAL_STATUSES (shiprocketStatusCodes.js) for the same
// reason, so it's ranked here alongside out_for_delivery rather than treated
// as an exception. Anything not listed here (cancelled/rto_*/lost/failed, or
// any other exception status) is left alone entirely — those are genuine
// dead ends or need the admin's direct attention, not a status stamped over
// them.
const SHIPMENT_STATUS_RANK = {
  pending: 0,
  awaiting_manual_fulfillment: 0,
  processing: 1,
  pickup_scheduled: 2,
  picked_up: 2,
  in_transit: 2,
  shipped: 2,
  out_for_delivery: 2,
  undelivered: 2,
  delivered: 3,
  fulfilled: 3,
  self_fulfilled: 3,
};

/**
 * The other direction of orderSync.js's deriveOrderStatus: when an admin
 * manually sets order.orderStatus (updateOrderStatus, bypassing shipment
 * tracking), push that forward onto every shipment on the order too —
 * otherwise the Shipment documents (and their order.shipments[] mirror)
 * stay stuck at whatever Shiprocket last reported, which silently blocks
 * return requests (requestReturn requires shipment.status === "delivered")
 * even though the order itself now shows "delivered".
 *
 * Forward-only per shipment via SHIPMENT_STATUS_RANK, mirroring
 * deriveOrderStatus's own forward-only guarantee — so this can never
 * regress a shipment whose real courier status is already further along
 * than the admin's manual pick, and never touches one sitting in an
 * exception state. No-op (and no query) for order statuses with no
 * shipment-side equivalent, and for orders with no shipments at all
 * (digital orders, or a physical order before fulfillment starts).
 */
export async function syncShipmentsToOrderStatus(order, orderStatus) {
  const targetShipmentStatus = ORDER_STATUS_TO_SHIPMENT_STATUS[orderStatus];
  if (!targetShipmentStatus) return;

  const targetRank = SHIPMENT_STATUS_RANK[targetShipmentStatus];
  const shipments = await Shipment.find({ order: order._id });

  for (const shipment of shipments) {
    const currentRank = SHIPMENT_STATUS_RANK[shipment.status];
    if (currentRank === undefined || targetRank <= currentRank) continue;

    shipment.status = targetShipmentStatus;
    shipment.statusHistory.push({ code: null, status: targetShipmentStatus, at: new Date() });

    await shipment.save();
    await syncShipmentSummary(order, shipment);
  }
}

// ─── Returns / reverse logistics (self-fulfilled items only) ──────────────

// `orderItemId` (the order line's own _id, order.model.js) disambiguates
// between two lines for the *same* product with different
// variant/design/metal selections — without it, this always resolved to
// whichever line came first, silently refunding/restocking the wrong one
// on an order with e.g. the same ring in two sizes. Falls back to matching
// by product id alone when no orderItemId is given (older Return/Shipment
// records created before order items had their own id, or a caller that
// genuinely only has a product id) — that fallback is exact for the common
// case of one line per product, same as before.
export function findOrderItem(order, productId, orderItemId = null) {
  if (orderItemId) {
    const byId = order.items.find((i) => i._id && String(i._id) === String(orderItemId));
    if (byId) return byId;
  }
  return order.items.find((i) => String(i.product?._id || i.product) === String(productId));
}

// Units reserved by other still-pending ("requested") returns on this
// order — NOT approved/refunded ones, since those are already folded into
// `orderItem.returnedQuantity` at approval time; counting them here too
// would double-subtract the same units and make already-returned items
// look over-claimed. Only pending requests need this separate reservation,
// since they haven't touched `returnedQuantity` yet. Reads from the
// Order.returns summary array (kept in sync with the canonical Return
// collection), so no extra query is needed here.
function claimedReturnQuantity(order, productId) {
  let claimed = 0;
  for (const ret of order.returns) {
    if (ret.status !== "requested") continue;
    for (const item of ret.items) {
      if (String(item.product) === String(productId)) claimed += item.quantity;
    }
  }
  return claimed;
}

// Refund math deliberately mirrors calculateCart's own discount/GST
// allocation (priceengine.js) instead of trusting orderItem.price alone.
// orderItem.price is the pre-coupon-discount unit price — priceengine.js
// never writes the discounted amount back onto the item, only onto
// order.subTotal/discount at the order level — so re-deriving the same
// itemShare/taxableValue formula here is what actually backs the coupon
// discount out of the refund instead of refunding the undiscounted price.
// This also avoids double-counting inclusive-type GST: for an inclusive
// item, taxAmount is backed OUT of the (already discount-adjusted) taxable
// value rather than added on top, so the correct refund is just the
// taxable value itself — adding taxAmount on top of it as the old code did
// double-counted the tax for every inclusive-GST item.
function computeItemRefundAmount(order, orderItem, returnQuantity) {
  const lineTotal = (orderItem.price || 0) * orderItem.quantity;
  const itemShare = order.subTotal > 0 ? lineTotal / order.subTotal : 0;
  const itemDiscount = (order.discount || 0) * itemShare;
  const taxableValue = Math.max(0, lineTotal - itemDiscount);
  const paidForLine = taxableValue + (orderItem.taxType === "exclusive" ? orderItem.taxAmount || 0 : 0);
  const paidPerUnit = orderItem.quantity ? paidForLine / orderItem.quantity : 0;
  return paidPerUnit * returnQuantity;
}

// Same itemShare allocation as computeItemRefundAmount, reused for the
// Shiprocket order/label payload — orderItem.taxAmount is already the
// correct post-discount line tax (computed by priceengine.js at checkout),
// but the previous payload sent the pre-discount `selling_price` alongside
// a hardcoded `discount: 0`. Shiprocket's own label math is effectively
// `selling_price * units - discount` as the taxable base, which with a
// zero discount never reconciled against the (correctly discount-adjusted)
// tax figure sitting right next to it — showing an inflated product amount
// and a GST figure that didn't match it. Populating `discount` with this
// item's real share of the order-level coupon discount is what makes the
// two numbers agree.
function computeLineDiscount(order, orderItem) {
  const lineTotal = (orderItem.price || 0) * orderItem.quantity;
  const itemShare = order.subTotal > 0 ? lineTotal / order.subTotal : 0;
  return (order.discount || 0) * itemShare;
}

// Atomic per-item counter update — a plain read-modify-`.save()` on the
// Order document (the old approach in approveReturn/rejectReturn) let two
// concurrent approvals/rejections for DIFFERENT returns on the same order
// race and lose one update, since both read the same in-memory
// `returnedQuantity` before either write landed. $inc is atomic regardless
// of how many other writers touch the same document concurrently. On the
// way down (delta < 0), the query filter itself requires enough quantity to
// subtract — atomically floors at 0 the same way the old `Math.max(0, ...)`
// did, but without a read-then-write race window.
async function adjustReturnedQuantity(orderId, productId, delta) {
  if (!delta) return;

  const filter = { _id: orderId, "items.product": productId };
  if (delta < 0) filter["items.returnedQuantity"] = { $gte: -delta };

  await Order.updateOne(filter, { $inc: { "items.$.returnedQuantity": delta } });
}

async function getReturnPolicyDays() {
  const settings = await Setting.findOne().select("order.returnPolicyDays").lean();
  return settings?.order?.returnPolicyDays ?? 7;
}

function findDeliveredAt(shipment) {
  const entry = shipment.statusHistory.find((h) => h.status === "delivered");
  return entry?.at || shipment.updatedAt || shipment.createdAt;
}

function buildReturnPickupPayload(order, user, returnEntry, pkg, config) {
  const address = order.shippingAddress || {};

  return {
    order_id: `${order._id}-RET-${returnEntry._id}`,
    order_date: new Date().toISOString().slice(0, 19).replace("T", " "),
    // The pickup side of a return is the CUSTOMER (courier collects from
    // them); the shipping/delivery side is OUR warehouse — reversed from a
    // forward order's billing/shipping roles.
    pickup_customer_name: address.fullName || "Customer",
    pickup_last_name: "",
    pickup_address: address.addressLine1 || "",
    pickup_address_2: address.addressLine2 || "",
    pickup_city: address.city || "",
    pickup_state: address.state || "",
    pickup_country: "India",
    pickup_pincode: address.pincode || "",
    pickup_email: user?.email || "",
    pickup_phone: address.phone || "",
    shipping_customer_name: config.warehouseName,
    shipping_address: config.warehouseAddress,
    shipping_city: config.warehouseCity,
    shipping_state: config.warehouseState,
    shipping_country: "India",
    shipping_pincode: config.warehousePincode,
    shipping_email: config.warehouseEmail,
    shipping_phone: config.warehousePhone,
    order_items: returnEntry.items.map((item) => {
      const orderItem = findOrderItem(order, item.product, item.orderItemId);
      if (!orderItem) {
        return { name: item.name, sku: item.sku || String(item.product), units: item.quantity, selling_price: 0, discount: 0, tax: 0 };
      }

      // A return can cover fewer units than the original line — scale the
      // line's discount/tax down to a per-unit figure first (same idea as
      // computeItemRefundAmount's paidPerUnit) before multiplying back up by
      // however many units this particular return actually covers, instead
      // of attaching the full original line's discount/tax to a partial
      // quantity.
      const perUnitDiscount = orderItem.quantity
        ? computeLineDiscount(order, orderItem) / orderItem.quantity
        : 0;
      const perUnitTax = orderItem.quantity ? (orderItem.taxAmount || 0) / orderItem.quantity : 0;

      return {
        name: item.name,
        sku: item.sku || String(item.product),
        units: item.quantity,
        selling_price: orderItem.price || 0,
        discount: perUnitDiscount * item.quantity,
        tax: perUnitTax * item.quantity,
      };
    }),
    payment_method: "Prepaid",
    sub_total: returnEntry.items.reduce((sum, item) => {
      const price = findOrderItem(order, item.product, item.orderItemId)?.price || 0;
      return sum + price * item.quantity;
    }, 0),
    length: pkg.dims.length,
    breadth: pkg.dims.width,
    height: pkg.dims.height,
    weight: pkg.weight,
  };
}

// Shared by approveReturn (first attempt) and retryReturnShipment (re-attempt)
// so the Shiprocket call chain lives in exactly one place. Mutates
// `returnEntry` in place; never throws — caller saves whatever succeeded.
async function attemptReturnShipment(order, returnEntry) {
  const user = await User.findById(order.user).select("email").lean();
  const config = await getShiprocketConfig();
  const pkg = estimatePackage(
    returnEntry.items.map((i) => ({ ...i, product: findOrderItem(order, i.product, i.orderItemId)?.product })),
  );

  try {
    // Resume from a prior partial attempt instead of unconditionally
    // re-creating the Shiprocket return order — retryReturnShipment can be
    // called again after a failure anywhere past order-creation (rate
    // lookup, AWB assignment, pickup generation), and re-running
    // createReturnPickup every time would leave duplicate, orphaned reverse
    // pickups at Shiprocket for the same return.
    if (!returnEntry.shiprocketReturnShipmentId) {
      const srReturn = await createReturnPickup(buildReturnPickupPayload(order, user, returnEntry, pkg, config));
      returnEntry.shiprocketReturnOrderId = srReturn?.order_id ? String(srReturn.order_id) : null;
      returnEntry.shiprocketReturnShipmentId = srReturn?.shipment_id ? String(srReturn.shipment_id) : null;

      if (!returnEntry.shiprocketReturnShipmentId) {
        returnEntry.error = "Shiprocket return order created but no shipment_id returned";
        return;
      }
    }

    if (!returnEntry.awb) {
      const rates = await getShippingRates({
        pickupPincode: order.shippingAddress?.pincode,
        deliveryPincode: config.warehousePincode || config.pickupPincode,
        weightKg: pkg.weight,
        cod: 0,
        isReturn: true,
      });

      const cheapest = [...rates].sort((a, b) => Number(a.rate) - Number(b.rate))[0];
      if (!cheapest) {
        returnEntry.error = "No courier serviceable for reverse pickup on this route";
        return;
      }

      const awbResult = await assignAWB(returnEntry.shiprocketReturnShipmentId, cheapest.courier_company_id);
      const awbData = awbResult?.response?.data;
      returnEntry.awb = awbData?.awb_code || null;
      returnEntry.courier = awbData?.courier_name || cheapest.courier_name || null;
      returnEntry.trackingUrl = buildTrackingUrl(returnEntry.awb);
    }

    if (returnEntry.awb && returnEntry.status !== "pickup_scheduled") {
      try {
        await generatePickup([returnEntry.shiprocketReturnShipmentId]);
      } catch (err) {
        // See the matching comment in createSelfShipment above — a retry of
        // a return whose pickup was already scheduled isn't a real failure.
        if (!isAlreadyInPickupQueueError(err)) throw err;
      }
      returnEntry.status = "pickup_scheduled";
      returnEntry.error = null;
    }
  } catch (err) {
    logger.error(`[return] Shiprocket reverse pickup failed for order ${order._id}: ${err.message}`);
    returnEntry.error = err.message;
  }
}

// Only called once inspection PASSES — receiving a returned package does not
// by itself mean the item is resellable; inspection gates whether it goes
// back into sellable stock. Variant-aware, mirroring reduceStock's branch.
async function restockReturnedItems(order, returnEntry) {
  for (const item of returnEntry.items) {
    const orderItem = findOrderItem(order, item.product, item.orderItemId);
    if (!orderItem) continue;

    const product = await Product.findById(item.product);
    if (!product) continue;

    if (product.hasVariants && orderItem.variantId) {
      const variant = product.variants.id(orderItem.variantId);

      // Cascading sub-variant, when the ordered item had one — mirrors
      // reduceStock's own subVariant-first precedence (order.controller.js).
      // Restocking the parent variant instead (the old behavior here) would
      // credit stock to a bucket that was never actually decremented,
      // permanently shrinking the real (sub-variant) inventory.
      const subVariant = variant && orderItem.subVariantId ? variant.subVariants?.id(orderItem.subVariantId) : null;

      if (subVariant) {
        subVariant.stock = (subVariant.stock || 0) + item.quantity;
        product.markModified("variants");
      } else if (variant) {
        variant.stock = (variant.stock || 0) + item.quantity;
        product.markModified("variants");
      }
    } else {
      product.stock = (product.stock || 0) + item.quantity;
    }

    try {
      await product.save();
    } catch (err) {
      logger.error(`[return] restock failed for product ${item.product}: ${err.message}`);
    }
  }
}

/**
 * Customer-initiated return request. Pure validation + DB write — no
 * Shiprocket call yet (that happens on admin approval). Only self-fulfilled,
 * delivered items within the configured return window (Setting.order.returnPolicyDays)
 * are eligible; requested quantity is checked against what's still
 * returnable (ordered - already-returned - claimed-by-other-open-returns).
 */
const REQUEST_RETURN_MAX_ATTEMPTS = 3;

export async function requestReturn(orderId, userId, { items, reason, customerComment }) {
  if (!items?.length) {
    throw new ApiError(400, "At least one item is required");
  }

  let lastVersionErr;

  // Retried on a version conflict the same way withCartRetry (cart.controler.js)
  // handles concurrent cart mutations — two return requests racing on the
  // same order (or a request racing an admin action) can both read the same
  // stale `order.returns`/`returnedQuantity` snapshot and both pass
  // validation against it. order.save() below throws a VersionError if the
  // order changed underneath us since it was read; on that conflict, the
  // Return doc this attempt already created (validated against now-stale
  // data) is deleted and everything is re-validated against a fresh read
  // rather than keeping a possibly-over-claimed Return around.
  for (let attempt = 0; attempt < REQUEST_RETURN_MAX_ATTEMPTS; attempt++) {
    const order = await Order.findById(orderId);
    if (!order) throw new ApiError(404, "Order not found");
    if (String(order.user) !== String(userId)) throw new ApiError(403, "Not your order");

    if (order.orderStatus === "cancelled") {
      throw new ApiError(400, "This order has been cancelled — a return can't be requested against it");
    }

    // A return request must resolve to exactly one origin shipment.
    // Requesting items split across two shipments in one call isn't
    // supported — ask the customer to request them separately.
    const requestedProductIds = items.map(({ productId }) => String(productId));
    const originShipment = order.shipments.find((s) =>
      requestedProductIds.every((pid) => s.items.some((i) => String(i.product) === pid)),
    );
    if (!originShipment) {
      throw new ApiError(
        400,
        "These items don't all belong to the same shipment — request returns separately per shipment",
      );
    }
    if (originShipment.status !== "delivered") {
      throw new ApiError(400, "Items must be delivered before requesting a return");
    }

    const deliveredAt = findDeliveredAt(originShipment);
    const returnWindowDays = await getReturnPolicyDays();
    const cutoff = new Date(new Date(deliveredAt).getTime() + returnWindowDays * 24 * 60 * 60 * 1000);

    if (new Date() > cutoff) {
      throw new ApiError(400, `Return window (${returnWindowDays} days from delivery) has expired`);
    }

    const returnItems = [];
    // Tracks quantity already allocated to an earlier line in THIS SAME
    // request — without it, {productId: X, quantity: 1} repeated twice in
    // one call both validate against the same unmutated `remaining`, so a
    // single request can claim more of an item than is actually returnable.
    const claimedInThisRequest = new Map();

    for (const { productId, quantity, orderItemId } of items) {
      // orderItemId (the order line's own _id) disambiguates two lines for
      // the same product with different variant/design/metal selections —
      // without it, this always resolved to whichever line came first,
      // silently returning/refunding/restocking the wrong one. Optional for
      // backward compat with orders placed before order items had their own
      // id, or a caller that only has a product id.
      const orderItem = findOrderItem(order, productId, orderItemId);
      if (!orderItem) throw new ApiError(400, "Item not found on this order");

      const alreadyClaimed = claimedReturnQuantity(order, productId);
      const claimedHere = claimedInThisRequest.get(String(productId)) || 0;
      const remaining = orderItem.quantity - orderItem.returnedQuantity - alreadyClaimed - claimedHere;

      if (!quantity || quantity < 1 || quantity > remaining) {
        throw new ApiError(400, `Invalid return quantity for "${orderItem.name}" (${remaining} remaining)`);
      }

      claimedInThisRequest.set(String(productId), claimedHere + quantity);
      returnItems.push({
        product: orderItem.product,
        orderItemId: orderItem._id || null,
        name: orderItem.name,
        quantity,
        sku: null,
        // Snapshotted so the admin/warehouse can see exactly which option
        // was actually returned, same reasoning as the identical fields on
        // a Shipment (toShipmentItems) — previously always left null on a
        // Return, which also removed the one place an admin could have
        // caught a wrong-line mismatch.
        variantId: orderItem.variantId || null,
        subVariantId: orderItem.subVariantId || null,
        variantName: orderItem.variantName || null,
        variantValue: orderItem.variantValue || null,
        subVariantName: orderItem.subVariantName || null,
        subVariantValue: orderItem.subVariantValue || null,
        selectedRatti: orderItem.selectedRatti || null,
      });
    }

    const returnDoc = await Return.create({
      order: order._id,
      fulfillmentType: originShipment.fulfillmentType,
      originShipmentId: originShipment.shipmentId,
      items: returnItems,
      reason: reason || null,
      customerComment: customerComment || null,
      status: "requested",
      requestedAt: new Date(),
    });

    try {
      syncReturnSummary(order, returnDoc);
      await order.save();
    } catch (err) {
      if (err instanceof mongoose.Error.VersionError && attempt < REQUEST_RETURN_MAX_ATTEMPTS - 1) {
        await Return.deleteOne({ _id: returnDoc._id });
        lastVersionErr = err;
        continue;
      }
      throw err;
    }

    await notifyReturnStatus(order, returnDoc);
    return returnDoc;
  }

  throw lastVersionErr;
}

/**
 * Admin approval — locks the returned units (increments returnedQuantity so
 * they can't be claimed by another concurrent request), then attempts the
 * Shiprocket reverse-pickup chain. A Shiprocket failure here still leaves
 * the return "approved" with an `error` set, ready for retryReturnShipment.
 */
export async function approveReturn(returnId) {
  // Atomically claim the requested→approved transition before doing any
  // work — the old approach (findById, check status, mutate, save at the
  // very end) let two concurrent approve calls for the SAME return both
  // pass the status check, both increment returnedQuantity, and (for self
  // returns) both fire a real Shiprocket reverse-pickup request.
  const returnEntry = await Return.findOneAndUpdate(
    { _id: returnId, status: "requested" },
    { $set: { status: "approved" } },
    { new: true },
  );
  if (!returnEntry) {
    const existing = await Return.findById(returnId);
    if (!existing) throw new ApiError(404, "Return not found");
    throw new ApiError(400, `Cannot approve a return in status "${existing.status}"`);
  }

  const order = await Order.findById(returnEntry.order).populate(
    "items.product",
    "type name sku weight dimensions variants",
  );
  if (!order) throw new ApiError(404, "Order not found");

  // Atomic per-item increment (adjustReturnedQuantity) rather than an
  // in-memory `order.items` mutation — can't lose an update against a
  // concurrent approval of a DIFFERENT return on the same order.
  for (const item of returnEntry.items) {
    await adjustReturnedQuantity(order._id, item.product, item.quantity);
  }

  await attemptReturnShipment(order, returnEntry);

  await returnEntry.save();
  syncReturnSummary(order, returnEntry);
  await order.save();

  await notifyReturnStatus(order, returnEntry);
  return returnEntry;
}

/**
 * Admin rejection. If units were already locked (past "requested"), they're
 * released back to returnable. Never callable once refunded, and not once
 * inspection has already passed ("approved_for_refund") — restockReturnedItems
 * has already run by then, so rejecting at that point would release
 * returnedQuantity without reversing the restock, letting the same units be
 * returned and restocked again on a future request. approved_for_refund can
 * only move forward to refunded (processReturnRefund) from here on.
 */
export async function rejectReturn(returnId, { notes } = {}) {
  // Atomically claim any pre-terminal status → "rejected" — returned as the
  // BEFORE image specifically so the returnedQuantity-release decision below
  // can still branch on what the status was before this call, while the
  // claim itself still prevents a duplicate/racing reject call from running
  // that release logic twice.
  const previousEntry = await Return.findOneAndUpdate(
    { _id: returnId, status: { $nin: ["refunded", "rejected", "approved_for_refund"] } },
    { $set: { status: "rejected", adminNote: notes || null } },
    { returnDocument: "before" },
  );
  if (!previousEntry) {
    const existing = await Return.findById(returnId);
    if (!existing) throw new ApiError(404, "Return not found");
    throw new ApiError(400, `Cannot reject a return already in status "${existing.status}"`);
  }

  const order = await Order.findById(previousEntry.order);
  if (!order) throw new ApiError(404, "Order not found");

  if (previousEntry.status !== "requested") {
    for (const item of previousEntry.items) {
      await adjustReturnedQuantity(order._id, item.product, -item.quantity);
    }
  }

  const returnEntry = await Return.findById(returnId);
  syncReturnSummary(order, returnEntry);
  await order.save();

  await notifyReturnStatus(order, returnEntry);
  return returnEntry;
}

/** Re-runs the Shiprocket reverse-pickup chain for a return stuck in error. */
export async function retryReturnShipment(returnId) {
  const returnEntry = await Return.findById(returnId);
  if (!returnEntry) throw new ApiError(404, "Return not found");
  // Requiring `error` (not just the status) is what actually blocks
  // retrying a return whose pickup already fully succeeded — a
  // "pickup_scheduled" return with no error means attemptReturnShipment
  // reached the end of the chain cleanly, so calling it again would just
  // create a second, orphaned reverse pickup at Shiprocket for the same
  // return (attemptReturnShipment itself now also resumes from whatever
  // already succeeded rather than re-creating it, but there's still nothing
  // useful left to do once the whole chain is done).
  if (!["approved", "pickup_scheduled"].includes(returnEntry.status) || !returnEntry.error) {
    throw new ApiError(400, `Nothing to retry for a return in status "${returnEntry.status}"`);
  }

  const order = await Order.findById(returnEntry.order).populate(
    "items.product",
    "type name sku weight dimensions variants",
  );
  if (!order) throw new ApiError(404, "Order not found");

  await attemptReturnShipment(order, returnEntry);

  await returnEntry.save();
  syncReturnSummary(order, returnEntry);
  await order.save();

  await notifyReturnStatus(order, returnEntry);
  return returnEntry;
}

// Manual override for a self-fulfilled (Shiprocket) return that gets
// stuck — Shiprocket's status feed has no mapping for adverse outcomes like
// lost/damaged/qc_failed (see shiprocketStatusCodes.js), so a reverse
// shipment the courier loses just sits at its last resolved status forever
// with no way to progress it without this. Deliberately excludes
// "requested"/"approved" (handled by requestReturn/approveReturn) and
// "inspection_pending"/"approved_for_refund"/"rejected"/"refunded" (handled
// by markReturnInspected/processReturnRefund/rejectReturn) — this only
// covers the manual-tracking middle of the lifecycle a courier API would
// otherwise drive.
const MANUAL_RETURN_STATUSES = ["pickup_scheduled", "picked_up", "in_transit", "received"];

export async function updateManualReturnStatus(
  returnId,
  { status, awb, courier, trackingUrl, notes } = {},
) {
  const returnEntry = await Return.findById(returnId);
  if (!returnEntry) throw new ApiError(404, "Return not found");

  if (status && !MANUAL_RETURN_STATUSES.includes(status)) {
    throw new ApiError(400, `Invalid status — must be one of: ${MANUAL_RETURN_STATUSES.join(", ")}`);
  }

  if (awb !== undefined) returnEntry.awb = awb || null;
  if (courier !== undefined) returnEntry.courier = courier || null;
  if (trackingUrl !== undefined) returnEntry.trackingUrl = trackingUrl || null;
  if (notes !== undefined) returnEntry.adminNote = notes || null;

  const statusChanged = status && status !== returnEntry.status;

  if (statusChanged) {
    returnEntry.status = status;
    returnEntry.statusHistory.push({ code: null, status, at: new Date() });
    if (status === "received" && !returnEntry.receivedAt) {
      returnEntry.receivedAt = new Date();
    }
  }

  await returnEntry.save();

  const order = await Order.findById(returnEntry.order);
  if (order) {
    syncReturnSummary(order, returnEntry);
    await order.save();
  }

  if (statusChanged && order) {
    await notifyReturnStatus(order, returnEntry);
  }

  return returnEntry;
}

/**
 * Warehouse inspection outcome — only callable once tracking has moved the
 * return to "received". Passing restocks the items (see restockReturnedItems);
 * failing rejects the return outright (no refund).
 */
export async function markReturnInspected(returnId, { passed, notes, adminId }) {
  // Atomically claim "received" → the inspection outcome before doing any
  // restock/quantity work — the old find-then-save let a double-click (or
  // two concurrent inspect calls) both pass the "received" check and both
  // run restockReturnedItems, double-crediting stock for the same return.
  const nextStatus = passed ? "approved_for_refund" : "rejected";
  const returnEntry = await Return.findOneAndUpdate(
    { _id: returnId, status: "received" },
    {
      $set: {
        status: nextStatus,
        inspection: {
          passed: Boolean(passed),
          notes: notes || null,
          inspectedAt: new Date(),
          inspectedBy: adminId || null,
        },
      },
    },
    { new: true },
  );
  if (!returnEntry) {
    const existing = await Return.findById(returnId);
    if (!existing) throw new ApiError(404, "Return not found");
    throw new ApiError(400, `Return must be "received" before inspection (currently "${existing.status}")`);
  }

  const order = await Order.findById(returnEntry.order).populate(
    "items.product",
    "type name sku weight dimensions variants",
  );
  if (!order) throw new ApiError(404, "Order not found");

  if (passed) {
    await restockReturnedItems(order, returnEntry);
  } else {
    // A failed inspection means no refund, but the unit is done being
    // "in flight" as a return either way — release it back the same way
    // rejectReturn does for a pre-inspection rejection. Without this, the
    // customer permanently loses the ability to return that unit (no
    // refund, and it stays counted as "already returned" forever), and an
    // unrelated later return on the same order could incorrectly see "every
    // self-fulfilled unit returned" and refund shipping a second time.
    for (const item of returnEntry.items) {
      await adjustReturnedQuantity(order._id, item.product, -item.quantity);
    }
  }

  syncReturnSummary(order, returnEntry);
  await order.save();

  await notifyReturnStatus(order, returnEntry);
  return returnEntry;
}

/**
 * Executes the refund — Razorpay API call for razorpay-paid orders, a
 * manually-recorded Transaction for COD (admin has already refunded
 * offline). Shipping is included only once, only when this return
 * completes "every self-fulfilled unit on the order has been returned"
 * (checked across all non-rejected returns, not just this one).
 */
export async function processReturnRefund(returnId, { adminId, notes } = {}) {
  // Atomically claim approved_for_refund → refunded BEFORE calling Razorpay
  // — this is what actually prevents two admins double-clicking "Refund"
  // (or any other concurrent call) from both passing the status check and
  // both firing a real refund for the same return. The Razorpay-failure
  // path below reverts this claim back to "approved_for_refund" so the
  // return isn't left permanently marked "refunded" despite no money
  // having actually moved.
  const returnEntry = await Return.findOneAndUpdate(
    { _id: returnId, status: "approved_for_refund" },
    { $set: { status: "refunded" } },
    { new: true },
  );
  if (!returnEntry) {
    const existing = await Return.findById(returnId);
    if (!existing) throw new ApiError(404, "Return not found");
    throw new ApiError(
      400,
      `Return must be "approved_for_refund" before issuing a refund (currently "${existing.status}")`,
    );
  }

  const order = await Order.findById(returnEntry.order);
  if (!order) throw new ApiError(404, "Order not found");

  // Mirrors calculateCart's own discount/GST allocation exactly (see
  // computeItemRefundAmount) instead of refunding the pre-discount unit
  // price — the old computation here ignored any coupon discount applied
  // at checkout and double-counted inclusive-type GST.
  let amount = 0;
  for (const item of returnEntry.items) {
    const orderItem = findOrderItem(order, item.product, item.orderItemId);
    if (!orderItem) continue;
    amount += computeItemRefundAmount(order, orderItem, item.quantity);
  }

  const shippingAlreadyRefunded = order.returns.some((r) => r.refundIncludesShipping);
  const selfShipment = order.shipments.find((s) => s.fulfillmentType === "self");
  const allSelfUnitsReturned =
    !shippingAlreadyRefunded &&
    selfShipment?.items.every((si) => {
      const orderItem = findOrderItem(order, si.product, si.orderItemId);
      return orderItem && orderItem.returnedQuantity >= orderItem.quantity;
    });

  let refundIncludesShipping = false;
  if (allSelfUnitsReturned) {
    amount += order.selfShippingAmount ?? 0;
    refundIncludesShipping = true;
  }

  amount = Math.round(amount * 100) / 100;

  // Safety net against ever asking Razorpay to refund more than the
  // customer has left to be refunded — caps against what's actually still
  // outstanding after any prior successful refunds on this order, rather
  // than trusting the item-level math alone to always land inside that
  // bound.
  const [{ total: alreadyRefundedTotal } = { total: 0 }] = await Transaction.aggregate([
    { $match: { order: order._id, transactionType: "refund", status: "success" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const remainingRefundable = Math.max(0, (order.totalAmount || 0) - alreadyRefundedTotal);
  if (amount > remainingRefundable) {
    logger.error(
      `[return] computed refund ${amount} for return ${returnId} exceeds remaining refundable ${remainingRefundable} on order ${order._id} — capping`,
    );
    amount = remainingRefundable;
  }

  const originalTransaction = await Transaction.findOne({ order: order._id, transactionType: "order" });
  let refundTransaction;

  try {
    if (order.payment.method === "razorpay" && amount > 0) {
      const rzpRefund = await refundRazorpayPayment({
        paymentId: order.payment.transactionId,
        amount,
        notes: { orderId: String(order._id), returnId: String(returnId) },
      });

      refundTransaction = await Transaction.create({
        user: order.user,
        order: order._id,
        transactionType: "refund",
        amount,
        currency: order.payment?.currency || "INR",
        method: "razorpay",
        status: "success",
        razorpayRefundId: rzpRefund?.id || null,
        refundOf: originalTransaction?._id || null,
        rawResponse: rzpRefund,
      });
    } else {
      // COD, or nothing left to refund (remainingRefundable capped amount to
      // 0 — most likely the order was already fully refunded through some
      // other path). Razorpay rejects a zero-amount refund call outright, so
      // for the amount<=0 case this records the reconciliation without ever
      // calling out to Razorpay; for COD there's no online refund to begin
      // with (admin has refunded offline via bank transfer/cash).
      if (amount <= 0) {
        logger.error(
          `[return] nothing left to refund for return ${returnId} on order ${order._id} (remaining refundable ${remainingRefundable}) — recording a zero-amount refund without contacting Razorpay`,
        );
      }
      refundTransaction = await Transaction.create({
        user: order.user,
        order: order._id,
        transactionType: "refund",
        amount,
        currency: order.payment?.currency || "INR",
        method: "manual",
        status: "success",
        refundOf: originalTransaction?._id || null,
        rawResponse: { adminId, notes },
      });
    }
  } catch (err) {
    logger.error(`[return] Razorpay refund failed for order ${order._id}: ${err.message}`);

    returnEntry.status = "approved_for_refund";
    returnEntry.error = `Refund failed: ${err.message}`;
    await returnEntry.save();
    syncReturnSummary(order, returnEntry);
    await order.save();

    // Every other terminal/error path in this lifecycle ends by notifying —
    // this one used to throw before ever reaching it, so a failed Razorpay
    // refund was invisible to everyone except whichever admin session
    // happened to click the button.
    await notifyReturnStatus(order, returnEntry);
    throw new ApiError(502, `Razorpay refund failed: ${err.message}`);
  }

  returnEntry.refundAmount = amount;
  returnEntry.refundIncludesShipping = refundIncludesShipping;
  returnEntry.refundTransactionId = refundTransaction._id;
  // Denormalized straight onto the return (and its order.returns[] mirror)
  // so the admin/customer return screens can show the refund ID and how it
  // was issued without a second query against Transaction.
  returnEntry.razorpayRefundId = refundTransaction.razorpayRefundId || null;
  returnEntry.refundMethod = refundTransaction.method;
  returnEntry.refundedAt = refundTransaction.createdAt;
  returnEntry.error = null;

  const [{ total: refundedTotal } = { total: 0 }] = await Transaction.aggregate([
    { $match: { order: order._id, transactionType: "refund", status: "success" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  order.payment.status = refundedTotal >= order.totalAmount ? "refunded" : "partially_refunded";

  await returnEntry.save();
  syncReturnSummary(order, returnEntry);
  await order.save();

  await notifyReturnStatus(order, returnEntry);
  return returnEntry;
}
