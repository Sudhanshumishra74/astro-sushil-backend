import { Worker } from "bullmq";
import cron from "node-cron";
import sendEmail from "../service/sendEmail.js";
import {
  sendOrderWhatsapp,
  sendBookingConfirmedWhatsapp,
  sendReportOrderConfirmedWhatsapp,
  sendReportReadyWhatsapp,
  sendConsultationReminderWhatsapp,
  sendConsultationRescheduleWhatsapp,
  sendBookingUpdatedWhatsapp,
  sendReturnStatusWhatsapp,
  sendRefundProcessedWhatsapp,
  sendAbandonedCartWhatsapp,
  sendRecommendedProductsWhatsapp,
} from "../service/sendWhatsapp.js";
import { sendSmsLane } from "../service/smslane.js";
import { smsTemplates } from "../utils/smsTemplates.js";
import { notificationQueue } from "../queues/notification.queue.js";
import ReportOrder from "../modules/Reports/reportOrder.model.js";
import { Booking } from "../modules/booking/booking.model.js";
import { redisConnection } from "../config/redis.js";
import { ApiError } from "../utils/ApiError.js";
import {
  emailTemplates,
  RETURN_STATUS_META,
  DEFAULT_RETURN_STATUS_META,
} from "../utils/emailTemplates.js";
import { Order } from "../modules/Order/order.model.js";
import { Transaction } from "../modules/Transaction/Transaction.model.js";
import Cart from "../modules/cart/cart.modal.js";
import { Product } from "../modules/products/product.modal.js";
import Setting from "../modules/Setting/Setting.model.js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const REPORT_SEND_CRON = process.env.REPORT_SEND_CRON || "0 * * * *"; // every hour
const REPORT_SEND_DELAY_HOURS = process.env.REPORT_SEND_DELAY_HOURS
  ? Number(process.env.REPORT_SEND_DELAY_HOURS)
  : 24;
const CONSULTATION_REMINDER_CRON =
  process.env.CONSULTATION_REMINDER_CRON || "0 8 * * *"; // every day at 08:00 IST
const REMOVE_PENDING_RECORDS_CRON =
  process.env.REMOVE_PENDING_RECORDS_CRON || "0 * * * *"; // every hour
const ABANDONED_CART_CRON = process.env.ABANDONED_CART_CRON || "0 * * * *"; // every hour
const ABANDONED_CART_HOURS = process.env.ABANDONED_CART_HOURS
  ? Number(process.env.ABANDONED_CART_HOURS)
  : 2;
const LOW_STOCK_CHECK_CRON = process.env.LOW_STOCK_CHECK_CRON || "0 * * * *"; // every hour

const schedulePendingReportNotifications = async () => {
  try {
    const cutoff = new Date(
      Date.now() - REPORT_SEND_DELAY_HOURS * 60 * 60 * 1000,
    );

    const orders = await ReportOrder.find({
      reportStatus: "completed",
      isReportSent: false,
      updatedAt: { $lte: cutoff },
    }).select("_id");

    if (!orders || orders.length === 0) {
      return;
    }

    for (const order of orders) {
      await notificationQueue.add(
        "report-ready",
        { reportOrderId: order._id.toString() },
        {
          removeOnComplete: 100,
          removeOnFail: 100,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 3000,
          },
        },
      );
    }
  } catch (err) {
    console.error("Report scheduler error:", err);
  }
};

const schedulePendingConsultationReminders = async () => {
  try {
    const tomorrowDate = new Date();
    const istTomorrow = new Date(
      tomorrowDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    );
    istTomorrow.setDate(istTomorrow.getDate() + 1);

    const formattedTomorrow = `${String(istTomorrow.getDate()).padStart(2, "0")}-${String(
      istTomorrow.getMonth() + 1,
    ).padStart(2, "0")}-${istTomorrow.getFullYear()}`;

    const bookings = await Booking.find({
      date: formattedTomorrow,
      status: "booked",
      paymentStatus: "paid",
      isDeleted: false,
      reminderSent: { $ne: true },
    })
      .populate("userId", "firstName email phoneNumber")
      .populate("consultationId", "title");

    if (!bookings || bookings.length === 0) {
      return;
    }

    for (const booking of bookings) {
      const user = booking.userId;
      const consultation = booking.consultationId;

      if (!user?.email && !user?.phoneNumber) {
        continue;
      }

      await notificationQueue.add(
        "consultation-reminder",
        {
          bookingId: booking._id.toString(),
          userEmail: user?.email,
          userName: user?.firstName || "User",
          userPhone: user?.phoneNumber,
          consultationTitle: consultation?.title || "Consultation",
          mode: booking.mode,
          date: booking.date,
          slot: booking.slot,
        },
        {
          removeOnComplete: 100,
          removeOnFail: 100,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 3000,
          },
        },
      );
    }
  } catch (err) {
    console.error("Consultation reminder scheduler error:", err);
  }
};

const scheduleAbandonedCartReminders = async () => {
  try {
    const cutoff = new Date(Date.now() - ABANDONED_CART_HOURS * 60 * 60 * 1000);

    const carts = await Cart.find({
      "items.0": { $exists: true },
      updatedAt: { $lte: cutoff },
      abandonedCartReminderSentAt: null,
    })
      .populate("user", "firstName email phoneNumber")
      .select("items totalAmount user");

    console.log(`[abandoned-cart] cron tick — cutoff ${cutoff.toISOString()}, ${carts.length} eligible cart(s)`);

    if (!carts || carts.length === 0) {
      return;
    }

    for (const cart of carts) {
      if (!cart.user?.email && !cart.user?.phoneNumber) continue;

      await notificationQueue.add(
        "abandoned-cart-reminder",
        {
          cartId: cart._id.toString(),
          userEmail: cart.user.email,
          userName: cart.user.firstName || "there",
          userPhone: cart.user.phoneNumber,
          items: cart.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
          cartTotal: cart.totalAmount,
        },
        {
          removeOnComplete: 100,
          removeOnFail: 100,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 3000,
          },
        },
      );
    }
  } catch (err) {
    console.error("Abandoned cart scheduler error:", err);
  }
};

// Sweeps for products/variants/sub-variants at or below the admin-configured
// Setting.product.lowStockWarning threshold, rather than hooking into every
// place stock can change (order placement, cancellation restock, returns,
// manual admin edits) — a periodic sweep catches all of them uniformly.
// lowStockNotifiedAt (product/variant/subVariant level, product.modal.js)
// dedupes so the same low-stock item doesn't re-alert on every tick; it's
// cleared below once stock is topped back up above the threshold, so a
// restock re-arms the alert for the next dip.
const scheduleLowStockAlerts = async () => {
  try {
    const settings = await Setting.findOne().select("product.lowStockWarning").lean();
    const threshold = settings?.product?.lowStockWarning ?? 5;

    await Product.updateMany(
      { hasVariants: false, stock: { $gt: threshold }, lowStockNotifiedAt: { $ne: null } },
      { $set: { lowStockNotifiedAt: null } },
    );
    await Product.updateMany(
      { hasVariants: true, "variants.lowStockNotifiedAt": { $ne: null } },
      { $set: { "variants.$[v].lowStockNotifiedAt": null } },
      { arrayFilters: [{ "v.stock": { $gt: threshold }, "v.lowStockNotifiedAt": { $ne: null } }] },
    );
    await Product.updateMany(
      { hasVariants: true, "variants.subVariants.lowStockNotifiedAt": { $ne: null } },
      { $set: { "variants.$[].subVariants.$[sv].lowStockNotifiedAt": null } },
      { arrayFilters: [{ "sv.stock": { $gt: threshold }, "sv.lowStockNotifiedAt": { $ne: null } }] },
    );

    const items = [];

    const simpleProducts = await Product.find({
      type: "physical",
      isPublished: true,
      hasVariants: false,
      stock: { $lte: threshold },
      lowStockNotifiedAt: null,
    }).select("name sku stock");

    for (const p of simpleProducts) {
      items.push({ productId: p._id.toString(), name: p.name, sku: p.sku, stock: p.stock });
    }

    const variantProducts = await Product.find({
      type: "physical",
      isPublished: true,
      hasVariants: true,
      $or: [
        { "variants.stock": { $lte: threshold }, "variants.lowStockNotifiedAt": null },
        { "variants.subVariants.stock": { $lte: threshold }, "variants.subVariants.lowStockNotifiedAt": null },
      ],
    }).select("name variants");

    for (const p of variantProducts) {
      for (const v of p.variants || []) {
        if (v.subVariants?.length) {
          for (const sv of v.subVariants) {
            if (sv.stock <= threshold && !sv.lowStockNotifiedAt) {
              items.push({
                productId: p._id.toString(),
                variantId: v._id.toString(),
                subVariantId: sv._id.toString(),
                name: p.name,
                variantLabel: `${v.name}: ${v.value} / ${sv.name}: ${sv.value}`,
                stock: sv.stock,
              });
            }
          }
        } else if (v.stock <= threshold && !v.lowStockNotifiedAt) {
          items.push({
            productId: p._id.toString(),
            variantId: v._id.toString(),
            name: p.name,
            variantLabel: `${v.name}: ${v.value}`,
            stock: v.stock,
          });
        }
      }
    }

    if (!items.length) return;

    console.log(`[low-stock] cron tick — ${items.length} item(s) at or below threshold ${threshold}`);

    await notificationQueue.add("low-stock-alert", { items, threshold });
  } catch (err) {
    console.error("Low stock scheduler error:", err);
  }
};

cron.schedule(REPORT_SEND_CRON, schedulePendingReportNotifications, {
  scheduled: true,
  timezone: process.env.CRON_TIMEZONE || "UTC",
});

cron.schedule(
  CONSULTATION_REMINDER_CRON,
  schedulePendingConsultationReminders,
  {
    scheduled: true,
    timezone: process.env.CRON_TIMEZONE || "UTC",
  },
);

cron.schedule(REMOVE_PENDING_RECORDS_CRON, removePendingOrdersAndTransactions, {
  scheduled: true,
  timezone: process.env.CRON_TIMEZONE || "UTC",
});

cron.schedule(ABANDONED_CART_CRON, scheduleAbandonedCartReminders, {
  scheduled: true,
  timezone: process.env.CRON_TIMEZONE || "UTC",
});

cron.schedule(LOW_STOCK_CHECK_CRON, scheduleLowStockAlerts, {
  scheduled: true,
  timezone: process.env.CRON_TIMEZONE || "UTC",
});

schedulePendingReportNotifications();
schedulePendingConsultationReminders();

const notificationsWorker = new Worker(
  "notifications",

  async (job) => {
    try {
      switch (job.name) {
        case "order-confirmed":
          await handleOrderConfirmed(job.data);
          break;

        case "booking-confirmed":
          await handleBookingConfirmed(job.data);
          break;

        case "consultation-reminder":
          await handleConsultationReminder(job.data);
          break;

        case "report-order-confirmed":
          await handleReportOrderConfirmed(job.data);
          break;

        case "report-ready":
          await handleReportReady(job.data);
          break;

        case "reschedule-booking":
          await handleRescheduleBooking(job.data);
          break;

        case "booking-upgraded":
          await handleBookingUpgraded(job.data);
          break;

        case "shipment-update":
          await handleShipmentUpdate(job.data);
          break;

        case "return-status-update":
          await handleReturnStatusUpdate(job.data);
          break;

        case "abandoned-cart-reminder":
          await handleAbandonedCartReminder(job.data);
          break;

        case "booking-products-recommended":
          await handleBookingProductsRecommended(job.data);
          break;

        case "low-stock-alert":
          await handleLowStockAlert(job.data);
          break;

        default:
          throw new ApiError(400, `Unknown notification type: ${job.name}`);
      }
    } catch (err) {
      // BullMQ requires an Error instance — toJSON() produces a plain object
      // which BullMQ can't serialize as a proper failure reason.
      const message =
        err instanceof ApiError ? err.message : err?.message || String(err);
      throw new Error(message);
    }
  },
  {
    connection: redisConnection,
  },
);

notificationsWorker.on("failed", (job, err) => {
  console.error(
    `[notifications] Job failed | type: ${job?.name} | jobId: ${job?.id} | attempt: ${job?.attemptsMade}/${job?.opts?.attempts ?? 1} | reason: ${err?.message}`,
    { jobData: job?.data },
  );
});

notificationsWorker.on("error", (err) => {
  console.error("[notifications] Worker connection error:", err);
});

const handleOrderConfirmed = async (data) => {
  const {
    orderId,
    orderStatus,
    userEmail,
    userName,
    userPhone,
    subTotal,
    discount,
    couponCode,
    totalAmount,
    shipping,
    tax,
    products = [],
    address,
    orderType,
    currency = "INR",
  } = data;

  console.log("ORDER CONFIRMED", orderStatus);

  console.error("ORDER TYPE: ", orderType);

  // Customer-facing order number must match the short form shown
  // everywhere else (emails, admin panel, invoice/credit-note PDFs) — the
  // email templates truncate internally, but WhatsApp/SMS take a plain
  // string so it's done once here.
  const shortOrderId = String(orderId || "")
    .slice(-8)
    .toUpperCase();

  // orderType is "physical" whenever ANY item is physical, even one bought
  // alongside a digital item (order.model.js) — so it alone can't tell a
  // mixed order apart from a pure-physical one, and a mixed order's digital
  // item(s) would silently never get a download link. Each item's own
  // `type` (order.model.js's orderItemSchema, passed through in every
  // enqueue site's `products` mapping) is the reliable per-item signal.
  const hasDigitalItems = products.some((p) => p.type === "digital");
  const downloadLink = hasDigitalItems
    ? `${process.env.FRONTEND_URL}/dashboard?tab=downloads`
    : null;

  if (userEmail) {
    try {
      const { subject, html } = emailTemplates.ORDER_CONFIRMED_USER({
        userName,
        orderStatus,
        orderId,
        products,
        subTotal,
        discount,
        couponCode,
        totalAmount,
        shipping,
        tax,
        address,
        orderType,
        currency,
        downloadLink,
      });
      await sendEmail({ to: userEmail, subject, html });
    } catch (err) {
      console.error({ orderId, err }, "order-confirmed: user email failed");
    }
  }

  if (ADMIN_EMAIL) {
    try {
      const { subject, html } = emailTemplates.ORDER_UPDATED_ADMIN({
        userName,
        orderStatus,
        userEmail,
        userPhone,
        orderId,
        products,
        subTotal,
        discount,
        couponCode,
        totalAmount,
        shipping,
        tax,
        currency,
      });
      await sendEmail({ to: ADMIN_EMAIL, subject, html });
    } catch (err) {
      console.error({ orderId, err }, "order-confirmed: admin email failed");
    }
  }

  if (userPhone) {
    try {
      const productNames = products.length
        ? products.map((p) => p.name).join(", ")
        : "No Products";
      await sendOrderWhatsapp({
        name: userName,
        phone: userPhone,
        orderId: shortOrderId,
        productName: productNames,
        status: orderStatus,
        downloadLink,
      });
    } catch (err) {
      console.error({ orderId, err }, "order-confirmed: whatsapp failed");
    }

    try {
      const productNames = products.length
        ? products.map((p) => p.name).join(", ")
        : "No Products";
      await sendSmsLane({
        mobileNumber: userPhone,
        message: smsTemplates.ORDER_UPDATE({
          userName: userName || "Customer",
          orderId: shortOrderId,
          productName: productNames,
          orderStatus,
        }),
      });
    } catch (err) {
      console.error({ orderId, err }, "order-confirmed: sms failed");
    }
  }
};

const handleShipmentUpdate = async (data) => {
  const {
    orderId,
    shipmentId,
    fulfillmentType,
    status,
    statusCode,
    courier,
    awb,
    trackingUrl,
    userEmail,
    userName,
    items,
    currency,
  } = data;

  console.log("SHIPMENT UPDATE", { orderId, shipmentId, status, statusCode });

  if (userEmail) {
    try {
      const { subject, html } = emailTemplates.SHIPMENT_UPDATE_USER({
        userName,
        orderId,
        fulfillmentType,
        status,
        courier,
        awb,
        trackingUrl,
        items,
        currency,
      });
      await sendEmail({ to: userEmail, subject, html });
    } catch (err) {
      console.error(
        { orderId, shipmentId, err },
        "shipment-update: user email failed",
      );
    }
  }

  if (ADMIN_EMAIL) {
    try {
      const { subject, html } = emailTemplates.SHIPMENT_UPDATE_ADMIN({
        userName,
        userEmail,
        orderId,
        shipmentId,
        fulfillmentType,
        status,
        statusCode,
        courier,
        awb,
        trackingUrl,
        items,
        currency,
      });
      await sendEmail({ to: ADMIN_EMAIL, subject, html });
    } catch (err) {
      console.error(
        { orderId, shipmentId, err },
        "shipment-update: admin email failed",
      );
    }
  }

  // WhatsApp/SMS for shipment updates need a dedicated approved template
  // (a WHATCHIMP_*_TEMPLATE_ID / DLT SMS template, same as
  // WHATCHIMP_ORDER_TEMPLATE_ID etc. in .env) before they can send — not
  // configured yet, so intentionally left email-only for now. Add a
  // template ID and wire in sendOrderWhatsapp/sendSmsLane the same way
  // handleOrderConfirmed does once one exists.
};

const handleReturnStatusUpdate = async (data) => {
  const {
    orderId,
    returnId,
    status,
    fulfillmentType,
    awb,
    courier,
    trackingUrl,
    refundAmount,
    refundIncludesShipping,
    razorpayRefundId,
    refundMethod,
    shippingAmount,
    currency,
    reason,
    adminNote,
    error,
    items,
    userEmail,
    userName,
    userPhone,
  } = data;

  console.log("RETURN STATUS UPDATE", { orderId, returnId, status });

  if (userEmail) {
    try {
      const { subject, html } = emailTemplates.RETURN_STATUS_UPDATE_USER({
        userName,
        orderId,
        returnId,
        status,
        fulfillmentType,
        courier,
        awb,
        trackingUrl,
        refundAmount,
        refundIncludesShipping,
        refundMethod,
        shippingAmount,
        currency,
        reason,
        adminNote,
        items,
      });
      await sendEmail({ to: userEmail, subject, html });
    } catch (err) {
      console.error(
        { orderId, returnId, err },
        "return-status-update: user email failed",
      );
    }
  }

  if (ADMIN_EMAIL) {
    try {
      const { subject, html } = emailTemplates.RETURN_STATUS_UPDATE_ADMIN({
        userName,
        userEmail,
        orderId,
        returnId,
        status,
        fulfillmentType,
        courier,
        awb,
        trackingUrl,
        refundAmount,
        refundIncludesShipping,
        razorpayRefundId,
        refundMethod,
        shippingAmount,
        currency,
        reason,
        adminNote,
        error,
        items,
      });
      await sendEmail({ to: ADMIN_EMAIL, subject, html });
    } catch (err) {
      console.error(
        { orderId, returnId, err },
        "return-status-update: admin email failed",
      );
    }
  }

  if (userPhone) {
    try {
      const linkFallback = `${process.env.FRONTEND_URL}/dashboard?tab=orders`;

      if (status === "refunded") {
        await sendRefundProcessedWhatsapp({
          phone: userPhone,
          userName,
          orderId,
          refundAmount,
          refundMethod,
          link: linkFallback,
        });
      } else {
        const meta = RETURN_STATUS_META[status] || DEFAULT_RETURN_STATUS_META;
        const message =
          status === "rejected" && adminNote ? adminNote : meta.message;

        await sendReturnStatusWhatsapp({
          phone: userPhone,
          userName,
          orderId,
          heading: meta.heading,
          message,
          link: trackingUrl || linkFallback,
        });
      }
    } catch (err) {
      console.error(
        { orderId, returnId, err },
        "return-status-update: whatsapp failed",
      );
    }
  }

  // shipment-update (courier tracking scans, as opposed to this return
  // lifecycle) stays email-only — Shiprocket already sends its own
  // WhatsApp/SMS tracking updates to the customer directly.
};


const handleAbandonedCartReminder = async (data) => {
  const { cartId, userEmail, userName, userPhone, items = [], cartTotal } = data;

  if (!userEmail && !userPhone) return;

  if (userEmail) {
    try {
      const { subject, html } = emailTemplates.ABANDONED_CART_USER({
        name: userName,
        items,
        cartTotal,
      });
      await sendEmail({ to: userEmail, subject, html });
      console.log(`[abandoned-cart] reminder sent to ${userEmail} for cart ${cartId}`);
    } catch (err) {
      console.error({ cartId, err }, "abandoned-cart-reminder: email failed");
    }
  }

  if (userPhone) {
    try {
      await sendAbandonedCartWhatsapp({
        phone: userPhone,
        userName,
        cartTotal,
        link: `${process.env.FRONTEND_URL}/cart`,
      });
    } catch (err) {
      console.error({ cartId, err }, "abandoned-cart-reminder: whatsapp failed");
    }
  }

  await Cart.updateOne(
    { _id: cartId },
    { $set: { abandonedCartReminderSentAt: new Date() } },
  );
};

const handleLowStockAlert = async (data) => {
  const { items = [], threshold } = data;

  if (!ADMIN_EMAIL || !items.length) return;

  try {
    const { subject, html } = emailTemplates.LOW_STOCK_ADMIN({ items, threshold });
    await sendEmail({ to: ADMIN_EMAIL, subject, html });
    console.log(`[low-stock] alert emailed to admin for ${items.length} item(s)`);
  } catch (err) {
    console.error({ err }, "low-stock-alert: admin email failed");
    return; // leave lowStockNotifiedAt unset so the next tick retries
  }

  for (const item of items) {
    if (item.subVariantId) {
      await Product.updateOne(
        { _id: item.productId },
        { $set: { "variants.$[v].subVariants.$[sv].lowStockNotifiedAt": new Date() } },
        { arrayFilters: [{ "v._id": item.variantId }, { "sv._id": item.subVariantId }] },
      );
    } else if (item.variantId) {
      await Product.updateOne(
        { _id: item.productId, "variants._id": item.variantId },
        { $set: { "variants.$.lowStockNotifiedAt": new Date() } },
      );
    } else {
      await Product.updateOne(
        { _id: item.productId },
        { $set: { lowStockNotifiedAt: new Date() } },
      );
    }
  }
};

const handleBookingProductsRecommended = async (data) => {
  const {
    bookingId,
    userEmail,
    userName,
    userPhone,
    consultationTitle,
    items = [],
  } = data;

  if (!userEmail && !userPhone) return;

  if (userEmail) {
    try {
      const { subject, html } = emailTemplates.RECOMMENDED_PRODUCTS_USER({
        name: userName,
        consultationTitle,
        items,
      });
      await sendEmail({ to: userEmail, subject, html });
    } catch (err) {
      console.error({ bookingId, err }, "booking-products-recommended: email failed");
    }
  }

  if (userPhone) {
    try {
      await sendRecommendedProductsWhatsapp({
        phone: userPhone,
        userName,
        consultationTitle,
        productNames: items.map((item) => item.name).filter(Boolean),
        link: `${process.env.FRONTEND_URL}/dashboard?tab=recommendations`,
      });
    } catch (err) {
      console.error({ bookingId, err }, "booking-products-recommended: whatsapp failed");
    }
  }
};

const handleBookingConfirmed = async (data) => {
  const {
    bookingId,
    userEmail,
    userName,
    userPhone,
    consultationTitle,
    includes = [],
    mode,
    date,
    slot,
    amount,
    currency = "INR",
  } = data;

  const ctx = {
    userName: userName || "User",
    bookingId,
    consultationTitle: consultationTitle || "Consultation",
    includes,
    mode: mode || "-",
    date: date || "-",
    slot: slot || "-",
    amount: amount || 0,
    currency,
  };

  // user email — isolated so failures never block WhatsApp
  if (userEmail) {
    try {
      const { subject, html } = emailTemplates.BOOKING_CONFIRMED_USER(ctx);
      await sendEmail({ to: userEmail, subject, html });
    } catch (err) {
      console.error({ bookingId, err }, "booking-confirmed: user email failed");
    }
  }

  // admin email — isolated
  if (ADMIN_EMAIL) {
    try {
      const { subject, html } = emailTemplates.BOOKING_CONFIRMED_ADMIN({
        ...ctx,
        userEmail,
        userPhone,
      });
      await sendEmail({ to: ADMIN_EMAIL, subject, html });
    } catch (err) {
      console.error(
        { bookingId, err },
        "booking-confirmed: admin email failed",
      );
    }
  }

  // user whatsapp — isolated
  if (userPhone) {
    try {
      await sendBookingConfirmedWhatsapp({
        phone: userPhone,
        userName: ctx.userName,
        consultationTitle: ctx.consultationTitle,
        date: ctx.date,
        mode: ctx.mode,
        slot: ctx.slot,
        amount: ctx.amount,
        includes: ctx.includes,
      });
    } catch (err) {
      console.error(
        { bookingId, err },
        "booking-confirmed: user whatsapp failed",
      );
    }

    try {
      await sendSmsLane({
        mobileNumber: userPhone,
        message: smsTemplates.BOOKING_CONFIRMED({
          userName: ctx.userName,
          consultationTitle: ctx.consultationTitle,
          date: ctx.date,
          mode: ctx.mode,
          slot: ctx.slot,
          amount: ctx.amount,
        }),
      });
    } catch (err) {
      console.error({ bookingId, err }, "booking-confirmed: user sms failed");
    }
  }

  // admin whatsapp — isolated
  const adminPhone = process.env.ADMIN_PHONE || process.env.SUPPORT_PHONE;
  if (adminPhone) {
    try {
      await sendBookingConfirmedWhatsapp({
        phone: adminPhone,
        userName: ctx.userName,
        consultationTitle: ctx.consultationTitle,
        date: ctx.date,
        mode: ctx.mode,
        slot: ctx.slot,
        amount: ctx.amount,
        includes: ctx.includes,
      });
    } catch (err) {
      console.error(
        { bookingId, err },
        "booking-confirmed: admin whatsapp failed",
      );
    }
  }
};

const handleConsultationReminder = async (data) => {
  const {
    bookingId,
    userEmail,
    userName,
    userPhone,
    consultationTitle,
    mode,
    date,
    slot,
  } = data;

  if (!bookingId) {
    throw new ApiError(400, "Invalid reminder payload");
  }

  // Atomic claim BEFORE sending anything — nothing upstream dedupes at
  // enqueue time (schedulePendingConsultationReminders re-matches and
  // re-enqueues any booking with reminderSent still false on every cron
  // tick *and* once immediately on every server boot), so two overlapping
  // runs — a restart landing near the daily cron tick, a BullMQ redelivery,
  // whatever — could otherwise both reach this point for the same booking
  // and both actually send the WhatsApp/email. Claiming first means only
  // the run that wins the race ever sends; a booking that's already
  // claimed (or was force-set by a previous partial success) is skipped
  // outright instead of resending.
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, reminderSent: { $ne: true } },
    { $set: { reminderSent: true, reminderSentAt: new Date() } },
    { new: false },
  );
  if (!booking) {
    return;
  }

  if (userEmail) {
    try {
      await sendEmail({
        to: userEmail,
        template: "BOOKING_REMINDER_USER",
        data: {
          userName: userName || "User",
          bookingId,
          consultationTitle: consultationTitle || "Consultation",
          mode: mode || "-",
          date: date || "-",
          slot: slot || "-",
        },
      });
    } catch (err) {
      console.error("Consultation reminder email failed:", err);
    }
  }

  if (userPhone) {
    try {
      await sendConsultationReminderWhatsapp({
        phone: userPhone,
        userName: userName || "User",
        consultationTitle: consultationTitle || "Consultation",
        date: date || "-",
        slot: slot || "-",
        mode: mode || "-",
      });
    } catch (err) {
      console.error("Consultation reminder WhatsApp failed:", err);
    }
  }
};

const handleReportOrderConfirmed = async (data) => {
  const { reportOrderId, userEmail, userName, userPhone, reportName } = data;

  if (userEmail) {
    try {
      const { subject, html } = emailTemplates.REPORT_ORDER_CONFIRMED_USER({
        userName: userName || "User",
        reportName: reportName || "Kundali Report",
      });
      await sendEmail({ to: userEmail, subject, html });
    } catch (err) {
      console.error(
        { reportOrderId, err },
        "report-order-confirmed: email failed",
      );
    }
  }

  if (userPhone) {
    try {
      await sendReportOrderConfirmedWhatsapp({
        phone: userPhone,
        userName: userName || "User",
      });
    } catch (err) {
      console.error(
        { reportOrderId, err },
        "report-order-confirmed: whatsapp failed",
      );
    }

    try {
      await sendSmsLane({
        mobileNumber: userPhone,
        message: smsTemplates.REPORT_PURCHASE({ userName: userName || "User" }),
      });
    } catch (err) {
      console.error(
        { reportOrderId, err },
        "report-order-confirmed: sms failed",
      );
    }
  }
};

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

const handleReportReady = async (data) => {
  const { reportOrderId } = data;

  const order = await ReportOrder.findById(reportOrderId).populate([
    "reportId",
    "userId",
  ]);

  if (!order || order.isReportSent || order.reportStatus !== "completed") {
    return;
  }

  const email = getReportOrderEmail(order);
  const phone = getReportOrderPhone(order);
  const fullName = getReportOrderName(order) || "User";
  const reportUrl = order.reportUrl;
  const reportName = order.reportId?.name || "Report";

  if (!reportUrl) {
    console.warn(
      "Report ready job skipped because reportUrl is missing",
      reportOrderId,
    );
    return;
  }

  let emailSent = order.isEmailSent;
  let whatsappSent = order.isWhatsappSent;

  if (email && !emailSent) {
    try {
      const { subject, html } = emailTemplates.REPORT_READY_USER({
        name: fullName,
        reportName,
        reportUrl,
      });

      await sendEmail({
        to: email,
        subject,
        html,
      });
      emailSent = true;
    } catch (err) {
      console.error(
        { reportOrderId, err },
        "report-ready: email failed",
      );
    }
  }

  if (phone && !whatsappSent) {
    try {
      await sendReportReadyWhatsapp({
        name: fullName,
        phone,
        reportName,
        reportUrl,
      });
      whatsappSent = true;
    } catch (err) {
      console.error(
        { reportOrderId, err },
        "report-ready: whatsapp failed",
      );
    }
  }

  order.isEmailSent = emailSent;
  order.isWhatsappSent = whatsappSent;

  const emailApplicable = Boolean(email);
  const whatsappApplicable = Boolean(phone);
  const emailFailed = emailApplicable && !emailSent;
  const whatsappFailed = whatsappApplicable && !whatsappSent;

  if (emailFailed && whatsappFailed) {
    console.error(
      { reportOrderId },
      "report-ready: both email and whatsapp failed, will retry next sweep",
    );
  } else if (emailFailed || whatsappFailed) {
    console.error(
      { reportOrderId, emailSent, whatsappSent },
      "report-ready: partial delivery failure, marking sent but one channel needs manual follow-up",
    );
  }

  if (emailSent || whatsappSent) {
    order.isReportSent = true;
  }

  await order.save();

  if (!order.isReportSent) {
    throw new Error("report-ready: no channel succeeded, will retry");
  }
};

const handleRescheduleBooking = async (data) => {
  const {
    bookingId,
    userEmail,
    userName,
    userPhone,
    consultationTitle,
    includes = [],
    mode,
    oldDate,
    oldSlot,
    newDate,
    newSlot,
    amount,
    currency = "INR",
  } = data;

  if (userEmail) {
    try {
      const { subject, html } = emailTemplates.BOOKING_RESCHEDULE_USER({
        userName: userName || "User",
        bookingId,
        consultationTitle: consultationTitle || "Consultation",
        mode: mode || "-",
        oldDate: oldDate || "-",
        oldSlot: oldSlot || "-",
        newDate: newDate || "-",
        newSlot: newSlot || "-",
        amount: amount || 0,
        currency,
      });
      await sendEmail({ to: userEmail, subject, html });
    } catch (err) {
      console.error(
        { bookingId, err },
        "reschedule-booking: user email failed",
      );
    }
  }

  if (ADMIN_EMAIL) {
    try {
      const { subject, html } = emailTemplates.BOOKING_RESCHEDULE_ADMIN({
        userName: userName || "User",
        userEmail,
        userPhone,
        bookingId,
        consultationTitle: consultationTitle || "Consultation",
        mode: mode || "-",
        oldDate: oldDate || "-",
        oldSlot: oldSlot || "-",
        newDate: newDate || "-",
        newSlot: newSlot || "-",
        amount: amount || 0,
        currency,
      });
      await sendEmail({ to: ADMIN_EMAIL, subject, html });
    } catch (err) {
      console.error(
        { bookingId, err },
        "reschedule-booking: admin email failed",
      );
    }
  }

  if (userPhone) {
    try {
      await sendConsultationRescheduleWhatsapp({
        phone: userPhone,
        userName,
        consultationTitle,
        date: newDate,
        slot: newSlot,
        serviceMode: mode,
        amount,
        includes,
        supportPhone: process.env.SUPPORT_PHONE,
      });
    } catch (err) {
      console.error({ bookingId, err }, "reschedule-booking: whatsapp failed");
    }

    try {
      await sendSmsLane({
        mobileNumber: userPhone,
        message: smsTemplates.BOOKING_RESCHEDULED({
          userName: userName || "User",
          consultationTitle: consultationTitle || "Consultation",
          date: newDate || "-",
          mode: mode || "-",
          slot: newSlot || "-",
          amount: amount || 0,
        }),
      });
    } catch (err) {
      console.error({ bookingId, err }, "reschedule-booking: sms failed");
    }
  }
};

const handleBookingUpgraded = async (data) => {
  const {
    bookingId,
    userEmail,
    userName,
    userPhone,
    consultationTitle,
    includes = [],
    mode,
    date,
    slot,
    amount,
    currency = "INR",
  } = data;

  if (userEmail) {
    try {
      const { subject, html } = emailTemplates.BOOKING_UPGRADED_USER({
        userName: userName || "User",
        bookingId,
        consultationTitle: consultationTitle || "Consultation",
        mode: mode || "-",
        date: date || "-",
        slot: slot || "-",
        amount: amount || 0,
        currency,
        includes,
      });
      await sendEmail({ to: userEmail, subject, html });
    } catch (err) {
      console.error({ bookingId, err }, "booking-upgraded: user email failed");
    }
  }

  if (userPhone) {
    try {
      await sendBookingUpdatedWhatsapp({
        phone: userPhone,
        userName,
        consultationTitle,
        date,
        slot,
        serviceMode: mode,
        amount,
        includes,
        supportPhone: process.env.SUPPORT_PHONE,
      });
    } catch (err) {
      console.error({ bookingId, err }, "booking-upgraded: whatsapp failed");
    }
  }
};

async function removePendingOrdersAndTransactions() {
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days

  const [orders, transactions, reportOrders, bookings] = await Promise.all([
    Order.deleteMany({
      orderStatus: "payment_pending",
      createdAt: { $lt: cutoff },
    }),
    // COD transactions now start "pending" and legitimately stay that way
    // for the entire shipping duration — finalizeCodPayment (orderSync.js)
    // only flips them to "success" on actual delivery, which routinely takes
    // longer than this cutoff. Only a "pending" *non-COD* (i.e. Razorpay)
    // transaction represents an abandoned checkout attempt that's actually
    // safe to sweep — deleting a live COD order's transaction record here
    // would also silently break finalizeCodPayment's lookup later, leaving
    // the order marked "paid" with no transaction behind it.
    Transaction.deleteMany({
      status: "pending",
      method: { $ne: "cod" },
      createdAt: { $lt: cutoff },
    }),
    ReportOrder.deleteMany({
      paymentStatus: "pending",
      createdAt: { $lt: cutoff },
    }),
    Booking.deleteMany({
      paymentStatus: "pending",
      createdAt: { $lt: cutoff },
    }),
  ]);

  console.log("Removed", orders.deletedCount, "pending orders");
  console.log("Removed", transactions.deletedCount, "pending transactions");
  console.log("Removed", reportOrders.deletedCount, "pending report orders");
  console.log("Removed", bookings.deletedCount, "pending bookings");
}
