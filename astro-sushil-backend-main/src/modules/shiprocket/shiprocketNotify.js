import { User } from "../auth/user.modal.js";
import { notificationQueue } from "../../queues/notification.queue.js";
import logger from "../../utils/logger.js";

/**
 * Shared by every return-lifecycle transition — both admin-triggered
 * (fulfillment.service.js) and tracking-driven (shiprocketTracking.service.js)
 * — so notification payload shape lives in exactly one place. Kept in its
 * own file (rather than inside either caller) specifically to avoid a
 * circular import between those two modules.
 */
export async function notifyReturnStatus(order, returnEntry) {
  try {
    const user = await User.findById(order.user)
      .select("firstName email phoneNumber")
      .lean();

    // returnEntry.items only carries product/name/quantity (shipmentItemSchema
    // has no price) — cross-referenced against the order's own item snapshot
    // (price/image are stored directly there, no populate needed) so the
    // email can actually show what's being returned and for how much,
    // instead of just a bare item name.
    const items = returnEntry.items.map((item) => {
      const orderItem = order.items?.find(
        (oi) => String(oi.product?._id || oi.product) === String(item.product),
      );
      return {
        name: item.name,
        quantity: item.quantity,
        price: orderItem?.price ?? null,
        image: orderItem?.image ?? null,
      };
    });

    await notificationQueue.add("return-status-update", {
      orderId: order._id.toString(),
      returnId: returnEntry._id.toString(),
      status: returnEntry.status,
      fulfillmentType: returnEntry.fulfillmentType,
      awb: returnEntry.awb,
      courier: returnEntry.courier,
      trackingUrl: returnEntry.trackingUrl,
      refundAmount: returnEntry.refundAmount,
      refundIncludesShipping: returnEntry.refundIncludesShipping,
      razorpayRefundId: returnEntry.razorpayRefundId,
      refundMethod: returnEntry.refundMethod,
      shippingAmount: order.shipping,
      currency: order.payment?.currency || "INR",
      reason: returnEntry.reason,
      adminNote: returnEntry.adminNote,
      // Admin-only signal (see RETURN_STATUS_UPDATE_ADMIN) — a failed
      // Razorpay refund attempt leaves the return's status unchanged
      // ("approved_for_refund") with this field set, so without surfacing
      // it here the notification would look identical to a normal
      // approval-pending-refund state and the failure would go unnoticed.
      error: returnEntry.error,
      items,
      userEmail: user?.email,
      userName: user?.firstName,
      userPhone: user?.phoneNumber,
    });
  } catch (err) {
    logger.error(`[return] notification enqueue failed for order ${order._id}: ${err.message}`);
  }
}
