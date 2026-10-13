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
} from "../service/sendWhatsapp.js";
import { sendSmsLane } from "../service/smslane.js";
import { smsTemplates } from "../utils/smsTemplates.js";
import { notificationQueue } from "../queues/notification.queue.js";
import ReportOrder from "../modules/Reports/reportOrder.model.js";
import { Booking } from "../modules/booking/booking.model.js";
import { redisConnection } from "../config/redis.js";
import { ApiError } from "../utils/ApiError.js";
import { emailTemplates } from "../utils/emailTemplates.js";
import { Order } from "../modules/Order/order.model.js";
import { Transaction } from "../modules/Transaction/Transaction.model.js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const REPORT_SEND_CRON = process.env.REPORT_SEND_CRON || "0 * * * *"; // every hour
const REPORT_SEND_DELAY_HOURS = process.env.REPORT_SEND_DELAY_HOURS
  ? Number(process.env.REPORT_SEND_DELAY_HOURS)
  : 24;
const CONSULTATION_REMINDER_CRON =
  process.env.CONSULTATION_REMINDER_CRON || "0 8 * * *"; // every day at 08:00 IST
const REMOVE_PENDING_RECORDS_CRON =
  process.env.REMOVE_PENDING_RECORDS_CRON || "0 * * * *"; // every hour

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
    totalAmount,
    shipping,
    products = [],
    address,
    orderType,
    currency = "INR",
  } = data;

  console.log("ORDER CONFIRMED", orderStatus);

  console.error("ORDER TYPE: ", orderType);

  const downloadLink =
    orderType === "digital"
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
        totalAmount,
        shipping,
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
        totalAmount,
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
        orderId,
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
          orderId,
          productName: productNames,
          orderStatus,
        }),
      });
    } catch (err) {
      console.error({ orderId, err }, "order-confirmed: sms failed");
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

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return;
  }

  let reminderSent = false;

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
      reminderSent = true;
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
      reminderSent = true;
    } catch (err) {
      console.error("Consultation reminder WhatsApp failed:", err);
    }
  }

  if (reminderSent) {
    booking.reminderSent = true;
    booking.reminderSentAt = new Date();
    await booking.save();
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
      console.error(
        { bookingId, err },
        "booking-upgraded: user email failed",
      );
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
    Transaction.deleteMany({
      status: "pending",
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
