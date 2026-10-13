import crypto from "crypto";
import mongoose from "mongoose";

import { Order } from "../modules/Order/order.model.js";
import { Booking } from "../modules/booking/booking.model.js";
import ReportOrder from "../modules/Reports/reportOrder.model.js";
import { Transaction } from "../modules/Transaction/Transaction.model.js";
import { Coupon } from "../modules/coupon/coupon.model.js";
import { User } from "../modules/auth/user.modal.js";
import { Consultation } from "../modules/consultation/consultation.modal.js";
import Cart from "../modules/cart/cart.modal.js";

import { notificationQueue } from "../queues/notification.queue.js";
import { reduceStock } from "../modules/Order/order.controller.js";
import { createDownloadsFromOrder } from "../modules/Download/download.controller.js";
import { generateReportAfterPayment } from "../modules/Reports/report.controller.js";

// ─── Order helpers ────────────────────────────────────────────────────────────

async function claimOrderPayment({
  transactionId,
  orderId,
  razorpayPaymentId,
  razorpayOrderId,
  session,
}) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, "payment.status": { $ne: "paid" } },
    {
      $set: {
        "payment.status": "paid",
        "payment.transactionId": razorpayPaymentId,
        "payment.razorpayOrderId": razorpayOrderId,
        orderStatus: "placed",
      },
    },
    { new: true, session },
  );

  if (!order) return null; // Already claimed by client verify

  await Transaction.findByIdAndUpdate(
    transactionId,
    { $set: { status: "success", transactionId: razorpayPaymentId } },
    { session },
  );

  return order;
}

async function afterOrderClaim(order) {
  try {
    await reduceStock(order);
  } catch (err) {
    console.error({ orderId: order._id, err }, "Webhook: stock reduction failed");
  }

  if (order.coupon?.code) {
    try {
      await Coupon.findOneAndUpdate(
        { code: order.coupon.code },
        {
          $inc: { usedCount: 1 },
          $push: { usedBy: { user: order.user, usedAt: new Date() } },
        },
      );
    } catch (err) {
      console.error({ orderId: order._id, err }, "Webhook: coupon update failed");
    }
  }

  try {
    await Cart.findOneAndUpdate(
      { user: order.user },
      {
        $set: {
          items: [],
          subTotal: 0,
          discount: 0,
          shipping: 0,
          tax: 0,
          totalAmount: 0,
          couponCode: null,
          appliedCoupon: null,
        },
      },
    );
  } catch (err) {
    console.error({ orderId: order._id, err }, "Webhook: cart clearing failed");
  }

  try {
    await createDownloadsFromOrder(order._id);

    if (order.orderType === "digital") {
      await Order.findByIdAndUpdate(order._id, {
        $set: { orderStatus: "delivered" },
      });
      order.orderStatus = "delivered";
    }
  } catch (err) {
    console.error({ orderId: order._id, err }, "Webhook: download creation failed");
  }

  try {
    const user = await User.findById(order.user)
      .select("firstName email phoneNumber")
      .lean();

    await notificationQueue.add("order-confirmed", {
      orderId: order._id.toString(),
      userEmail: user?.email,
      userName: user?.firstName,
      userPhone: user?.phoneNumber,
      subTotal: order.subTotal,
      totalAmount: order.totalAmount,
      shipping: order.shipping,
      currency: order.payment?.currency || "INR",
      orderType: order.orderType,
      products: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
    });
  } catch (err) {
    console.error({ orderId: order._id, err }, "Webhook: order notification failed");
  }
}

// ─── Booking helpers ──────────────────────────────────────────────────────────

async function claimBookingPayment({
  transactionId,
  bookingId,
  razorpayPaymentId,
  session,
}) {
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, paymentStatus: { $ne: "paid" } },
    { $set: { paymentStatus: "paid", status: "booked" } },
    { new: true, session },
  );

  if (!booking) return null; // Already claimed by client verify

  await Transaction.findByIdAndUpdate(
    transactionId,
    { $set: { status: "success", transactionId: razorpayPaymentId } },
    { session },
  );

  return booking;
}

async function enqueueBookingConfirmed(booking) {
  try {
    const [user, consultation] = await Promise.all([
      User.findById(booking.userId).select("firstName email phoneNumber").lean(),
      Consultation.findById(booking.consultationId)
        .select("title includes")
        .lean(),
    ]);

    await notificationQueue.add("booking-confirmed", {
      bookingId: booking._id.toString(),
      userEmail: user?.email,
      userName: user?.firstName,
      userPhone: user?.phoneNumber,
      consultationTitle: consultation?.title,
      includes: consultation?.includes || [],
      mode: booking.mode,
      date: booking.date,
      slot: booking.slot,
      amount: booking.amount,
      currency: booking.currency || "INR",
    });
  } catch (err) {
    console.error(
      { bookingId: booking._id, err },
      "Webhook: booking notification failed",
    );
  }
}

// ─── Report helpers ───────────────────────────────────────────────────────────

async function claimReportPayment({
  transactionId,
  reportOrderId,
  razorpayPaymentId,
  session,
}) {
  const order = await ReportOrder.findOneAndUpdate(
    { _id: reportOrderId, paymentStatus: { $ne: "paid" } },
    { $set: { paymentStatus: "paid", razorpayPaymentId } },
    { new: true, session },
  );

  if (!order) return null; // Already claimed by client verify

  await Transaction.findByIdAndUpdate(
    transactionId,
    { $set: { status: "success", transactionId: razorpayPaymentId } },
    { session },
  );

  return order;
}

// See the identical helpers in report.controller.js for why matchmaking
// notifies order.userId (the actual buyer) rather than the bride.
const getReportOrderPhone = (order) =>
  order.reportType === "match_making_pdf"
    ? order.userId?.phoneNumber || order.matchMakingDetails?.bride?.whatsappNumber
    : order.customerDetails?.whatsappNumber;

const getReportOrderName = (order) =>
  order.reportType === "match_making_pdf"
    ? [order.userId?.firstName, order.userId?.lastName].filter(Boolean).join(" ") ||
      order.matchMakingDetails?.bride?.fullName
    : order.customerDetails?.fullName;

const getReportOrderEmail = (order) =>
  order.reportType === "match_making_pdf"
    ? order.userId?.email || order.matchMakingDetails?.bride?.email
    : order.customerDetails?.email;

async function afterReportClaim(order) {
  try {
    await order.populate(["reportId", "userId"]);
    await generateReportAfterPayment(order);
    console.info({ reportOrderId: order._id }, "Webhook: report generation succeeded");
  } catch (err) {
    console.error({ reportOrderId: order._id, err }, "Webhook: report generation failed");
  }

  notificationQueue
    .add(
      "report-order-confirmed",
      {
        reportOrderId: order._id.toString(),
        userEmail: getReportOrderEmail(order),
        userName: getReportOrderName(order),
        userPhone: getReportOrderPhone(order),
        reportName: order.reportId?.name || "Kundali Report",
      },
      { attempts: 3, backoff: { type: "exponential", delay: 3000 }, removeOnComplete: 100, removeOnFail: 100 },
    )
    .catch((err) =>
      console.error({ reportOrderId: order._id, err }, "Webhook: failed to enqueue report-order-confirmed"),
    );
}

// ─── Unified webhook handler ──────────────────────────────────────────────────

export async function razorpayWebhook(req, res) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const receivedSignature = req.headers["x-razorpay-signature"];

  if (!webhookSecret || !receivedSignature) {
    console.warn("Webhook: missing secret or signature header");
    return res.status(400).json({ error: "Bad request" });
  }

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(req.body)
    .digest("hex");

  if (expectedSignature !== receivedSignature) {
    console.warn("Webhook: invalid signature");
    return res.status(400).json({ error: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  const { event: eventType } = event;
  console.info({ eventType }, "Razorpay webhook received");

  if (eventType !== "payment.captured") {
    return res.status(200).json({ received: true });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id) {
    console.warn("Webhook: payment.captured missing entity or order_id");
    return res.status(200).json({ received: true });
  }

  const razorpayOrderId = payment.order_id;
  const razorpayPaymentId = payment.id;

  const transaction = await Transaction.findOne({ razorpayOrderId }).lean();
  if (!transaction) {
    console.warn({ razorpayOrderId }, "Webhook: no transaction found");
    return res.status(200).json({ received: true });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (transaction.transactionType === "order") {
      const claimed = await claimOrderPayment({
        transactionId: transaction._id,
        orderId: transaction.order,
        razorpayPaymentId,
        razorpayOrderId,
        session,
      });

      await session.commitTransaction();
      session.endSession();

      if (!claimed) {
        console.info(
          { razorpayOrderId },
          "Webhook: order already claimed by client",
        );
        return res.status(200).json({ received: true });
      }

      console.info(
        { orderId: claimed._id, razorpayPaymentId },
        "Webhook: order payment confirmed",
      );

      afterOrderClaim(claimed).catch((err) =>
        console.error(
          { orderId: claimed._id, err },
          "Webhook: afterOrderClaim unhandled error",
        ),
      );

      return res.status(200).json({ received: true });
    }

    if (transaction.transactionType === "consultation") {
      const claimed = await claimBookingPayment({
        transactionId: transaction._id,
        bookingId: transaction.booking,
        razorpayPaymentId,
        session,
      });

      await session.commitTransaction();
      session.endSession();

      if (!claimed) {
        console.info(
          { razorpayOrderId },
          "Webhook: booking already claimed by client",
        );
        return res.status(200).json({ received: true });
      }

      console.info(
        { bookingId: claimed._id, razorpayPaymentId },
        "Webhook: booking payment confirmed",
      );

      enqueueBookingConfirmed(claimed).catch((err) =>
        console.error(
          { bookingId: claimed._id, err },
          "Webhook: enqueueBookingConfirmed unhandled error",
        ),
      );

      return res.status(200).json({ received: true });
    }

    if (transaction.transactionType === "report") {
      const claimed = await claimReportPayment({
        transactionId: transaction._id,
        reportOrderId: transaction.report,
        razorpayPaymentId,
        session,
      });

      await session.commitTransaction();
      session.endSession();

      if (!claimed) {
        console.info(
          { razorpayOrderId },
          "Webhook: report already claimed by client",
        );
        return res.status(200).json({ received: true });
      }

      console.info(
        { reportOrderId: claimed._id, razorpayPaymentId },
        "Webhook: report payment confirmed",
      );

      afterReportClaim(claimed).catch((err) =>
        console.error(
          { reportOrderId: claimed._id, err },
          "Webhook: afterReportClaim unhandled error",
        ),
      );

      return res.status(200).json({ received: true });
    }

    await session.abortTransaction();
    session.endSession();

    console.warn(
      { transactionType: transaction.transactionType },
      "Webhook: unhandled transaction type",
    );
    return res.status(200).json({ received: true });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error(
      { err, razorpayOrderId },
      "Webhook: failed to process payment",
    );
    return res.status(500).json({ error: "Internal error" });
  }
}
