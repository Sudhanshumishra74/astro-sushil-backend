import { Order } from "../Order/order.model.js";
import { Shipment } from "../Shipment/shipment.model.js";
import { Return } from "../Return/return.model.js";
import { User } from "../auth/user.modal.js";
import { notificationQueue } from "../../queues/notification.queue.js";
import { syncShipmentSummary, syncReturnSummary } from "../Fulfillment/orderSync.js";
import { findOrderItem } from "../Fulfillment/fulfillment.service.js";
import {
  resolveShiprocketStatus,
  resolveReturnStatus,
  SHIPROCKET_TERMINAL_STATUSES,
} from "./shiprocketStatusCodes.js";
import { notifyReturnStatus } from "./shiprocketNotify.js";
import logger from "../../utils/logger.js";

// Once a return has moved into one of these, tracking updates never move it
// backwards — an admin decision (inspection outcome, refund) or a
// customer-visible terminal state always wins over a late/stale webhook.
const RETURN_ADMIN_LOCKED_STATUSES = new Set([
  "inspection_pending",
  "approved_for_refund",
  "rejected",
  "refunded",
]);

// Only these transitions are worth emailing a customer about — every other
// intermediate warehouse-internal status still gets recorded on the
// shipment but doesn't spam a notification.
const NOTIFIABLE_STATUSES = new Set([
  "shipped",
  "out_for_delivery",
  "delivered",
  "undelivered",
  "rto_initiated",
  "rto_delivered",
  "cancelled",
  "picked_up",
]);

/**
 * Applies a Shiprocket status update to whichever Shipment document
 * matches the given AWB or shipment_id — shared by both the webhook handler
 * (real-time) and the polling tracking-sync job (fallback), so status
 * resolution and notification logic live in exactly one place.
 *
 * Always resolves `statusCode` through `resolveShiprocketStatus()` — never
 * matches on Shiprocket's raw status text.
 */
export async function applyShipmentStatusUpdate({ awb, shiprocketShipmentId, statusCode, extra = {} }) {
  if (!awb && !shiprocketShipmentId) return null;

  const query = awb ? { awb } : { shiprocketShipmentId: String(shiprocketShipmentId) };
  const shipment = await Shipment.findOne(query);
  if (!shipment) {
    logger.warn(
      `[shiprocket-tracking] no shipment found for ${awb ? `awb ${awb}` : `shipmentId ${shiprocketShipmentId}`}`,
    );
    return null;
  }

  const status = resolveShiprocketStatus(statusCode);
  const numericCode = Number(statusCode) || null;
  const changed = shipment.status !== status || shipment.statusCode !== numericCode;

  Object.assign(shipment, extra);

  if (!changed) {
    // Still persist any `extra` fields (e.g. a courier/AWB backfilled by the
    // polling job) even when the status itself hasn't moved.
    if (Object.keys(extra).length) {
      await shipment.save();
      const order = await Order.findById(shipment.order);
      if (order) {
        await syncShipmentSummary(order, shipment);
        await order.save();
      }
    }
    return shipment;
  }

  shipment.status = status;
  shipment.statusCode = numericCode;
  shipment.statusHistory.push({ code: numericCode, status, at: new Date() });

  await shipment.save();

  const order = await Order.findById(shipment.order);
  if (order) {
    await syncShipmentSummary(order, shipment);
    await order.save();
  }

  if (NOTIFIABLE_STATUSES.has(status) && order) {
    try {
      const user = await User.findById(order.user).select("firstName email").lean();

      await notificationQueue.add("shipment-update", {
        orderId: order._id.toString(),
        shipmentId: shipment._id.toString(),
        fulfillmentType: shipment.fulfillmentType,
        status,
        statusCode: numericCode,
        courier: shipment.courier,
        awb: shipment.awb,
        trackingUrl: shipment.trackingUrl,
        userEmail: user?.email,
        userName: user?.firstName,
        currency: order.payment?.currency || "INR",
        items: shipment.items.map((item) => {
          const orderItem = findOrderItem(order, item.product, item.orderItemId);
          return {
            name: item.name,
            quantity: item.quantity,
            variantLabel: [item.variantValue, item.subVariantValue].filter(Boolean).join(" / ") || null,
            price: orderItem?.price ?? null,
            image: item.selectedDesignImage || orderItem?.image || null,
          };
        }),
      });
    } catch (err) {
      logger.error(`[shiprocket-tracking] notification enqueue failed: ${err.message}`);
    }
  }

  return shipment;
}

export function isTerminalStatus(status) {
  return SHIPROCKET_TERMINAL_STATUSES.has(status);
}

/**
 * Same shape as applyShipmentStatusUpdate but for reverse (return) shipments
 * — matched by AWB only (Shiprocket return orders get their own numeric
 * order_id/shipment_id, tracked separately from the forward shipment's).
 * Resolves the business status via `resolveReturnStatus()` (a different
 * vocabulary than forward shipments — see shiprocketStatusCodes.js), and
 * never overwrites a return once an admin decision has moved it past
 * tracking's reach (inspection/refund/rejection).
 */
export async function applyReturnStatusUpdate({ awb, statusCode }) {
  if (!awb) return null;

  const returnEntry = await Return.findOne({ awb });
  if (!returnEntry) {
    logger.warn(`[shiprocket-tracking] no return found for awb ${awb}`);
    return null;
  }

  const numericCode = Number(statusCode) || null;
  if (returnEntry.statusCode === numericCode) return returnEntry; // nothing new

  const rawSlug = resolveShiprocketStatus(statusCode);
  returnEntry.statusCode = numericCode;
  returnEntry.statusHistory.push({ code: numericCode, status: rawSlug, at: new Date() });

  const businessStatus = resolveReturnStatus(statusCode);
  const locked = RETURN_ADMIN_LOCKED_STATUSES.has(returnEntry.status);

  if (businessStatus && !locked && businessStatus !== returnEntry.status) {
    returnEntry.status = businessStatus;
    if (businessStatus === "received" && !returnEntry.receivedAt) {
      returnEntry.receivedAt = new Date();
    }
  }

  await returnEntry.save();

  const order = await Order.findById(returnEntry.order);
  if (order) {
    syncReturnSummary(order, returnEntry);
    await order.save();
    await notifyReturnStatus(order, returnEntry);
  }

  return returnEntry;
}
