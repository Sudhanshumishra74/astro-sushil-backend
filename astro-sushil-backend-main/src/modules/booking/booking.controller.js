import crypto from "crypto";
import mongoose from "mongoose";

import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

import { Booking } from "./booking.model.js";
import { bookingZod } from "./booking.validation.js";

import { User } from "../auth/user.modal.js";
import { Consultation } from "../consultation/consultation.modal.js";

import { nowIST, parseDateIST } from "../../utils/time.js";

import puppeteer from "puppeteer";
import { Availability } from "../availability/availability.model.js";
import { Schedule } from "../availability/schedule.model.js";
import { Transaction } from "../Transaction/Transaction.model.js";
import { generateBookingInvoiceTemplate } from "../../utils/generateBookingInvoiceTemplate.js";
import { notificationQueue } from "../../queues/notification.queue.js";
import { getRateFor } from "../../utils/exchangeRate.js";
import { createRazorpayOrder } from "../../utils/razorpay.js";
import { computeGst } from "../../common/taxEngine.js";
import { findInvoiceForPdf } from "../../service/invoicePdfService.js";
import { allocateInvoiceInTransaction } from "../../service/invoiceAllocator.js";

const normalize = (s) => s?.toString().trim().replace(/\s+/g, "");

const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const parseSlot = (s) => {
  const [startStr, endStr] = normalize(s).split("-");
  return { start: toMinutes(startStr), end: toMinutes(endStr) };
};
const slotsOverlap = (slotA, slotB) => {
  const a = parseSlot(slotA);
  const b = parseSlot(slotB);
  return a.start < b.end && b.start < a.end;
};

const validateBooking = async ({
  consultationId,
  date,
  slot,
  isAdmin = false,
}) => {
  const parsedDate = parseDateIST(date);

  if (!parsedDate) {
    throw new ApiError(400, "Invalid date format");
  }

  const normalizedDate = parsedDate.format("DD-MM-YYYY");

  const consultation = await Consultation.findById(consultationId);

  if (!consultation) {
    throw new ApiError(404, "Consultation not found");
  }

  if (!isAdmin) {
    const allowedFromDate = nowIST()
      .add(consultation.responseDays || 0, "day")
      .startOf("day");

    if (parsedDate.isBefore(allowedFromDate)) {
      throw new ApiError(
        400,
        `Booking available from ${allowedFromDate.format("DD-MM-YYYY")}`,
      );
    }
  }

  const availability = await Availability.findOne();

  console.log("availability", availability);

  if (
    !availability ||
    !availability.startTime ||
    !availability.endTime ||
    !availability.slotDuration
  ) {
    throw new ApiError(400, "Invalid availability configuration");
  }

  const schedule = (await Schedule.findOne({
    date: normalizedDate,
  })) || {
    isBlocked: false,
    blockedSlots: [],
  };

  console.log("schedule", schedule);

  // Blocked-day and blocked-slot checks apply to customers only
  if (!isAdmin) {
    if (schedule.isBlocked) {
      throw new ApiError(400, "This day is not available");
    }

    if (schedule.blockedSlots.map(normalize).includes(normalize(slot))) {
      throw new ApiError(400, "This slot is blocked");
    }
  }

  // Reject if ANY consultation has an overlapping booking on this date
  const bookingsOnDate = await Booking.find({
    date: normalizedDate,
    status: "booked",
    isDeleted: false,
  }).select("slot");

  const hasOverlap = bookingsOnDate.some((b) =>
    slotsOverlap(normalize(slot), normalize(b.slot))
  );

  if (hasOverlap) {
    throw new ApiError(400, "This time slot overlaps with an existing booking");
  }

  return {
    consultation,
    normalizedDate,
  };
};

async function enqueueBookingConfirmed(booking) {
  try {
    const [user, consultation] = await Promise.all([
      User.findById(booking.userId)
        .select("firstName email phoneNumber")
        .lean(),
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

    console.info(
      `Booking ID: ${booking._id}`,
      "Notification queued successfully",
    );
  } catch (err) {
    console.error(
      err.message,
      "Failed to enqueue notification for booking",
      booking._id,
    );
  }
}

async function claimPaymentSuccess({
  bookingId,
  transactionId,
  razorpayPaymentId,
  session,
}) {
  const updatedBooking = await Booking.findOneAndUpdate(
    { _id: bookingId, paymentStatus: { $ne: "paid" } },
    { $set: { paymentStatus: "paid", status: "booked" } },
    { new: true, session },
  );

  if (!updatedBooking) {
    return null;
  }

  const transaction = await Transaction.findByIdAndUpdate(
    transactionId,
    { $set: { status: "success", transactionId: razorpayPaymentId } },
    { new: true, session },
  );
  if (!transaction) throw new ApiError(404, "Transaction not found");

  await allocateInvoiceInTransaction({
    sourceType: "booking",
    sourceId: updatedBooking._id,
    transactionId: transaction._id,
    session,
  });

  return updatedBooking;
}

export const createUserBooking = asyncHandler(async (req, res) => {
  const result = bookingZod.safeParse(req.body);
  if (!result.success) {
    const errors = result.error?.issues?.map((e) => e.message) || [
      "Invalid input",
    ];
    throw new ApiError(400, errors.join(", "));
  }

  const { consultationId, mode, date, slot, currency = "INR" } = result.data;

  if (!req.user?._id) throw new ApiError(401, "Unauthorized");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { consultation, normalizedDate } = await validateBooking({
      consultationId,
      date,
      slot,
    });

    const normalizeStr = (s) => s?.toString().trim().toLowerCase();
    const selectedMode = consultation.modes.find(
      (m) => normalizeStr(m.mode) === normalizeStr(mode),
    );
    if (!selectedMode) throw new ApiError(400, "Invalid mode selected");

    const currencyKey = currency.toLowerCase();
    const priceInr = selectedMode.price?.inr || 0;
    const exchangeRate = (await getRateFor(currency)) || 1;

    // Each consultation mode carries its own GST config. Inclusive means the
    // charge amount is unchanged (tax is backed out of priceInr for records);
    // exclusive means tax is added on top, increasing the actual charge.
    const gst = computeGst(priceInr, selectedMode.gst);
    const payableInr = gst.total;

    const finalAmount =
      selectedMode.price?.[currencyKey] ??
      Number((payableInr * exchangeRate).toFixed(2));
    const convertedGstAmount = Number((gst.taxAmount * exchangeRate).toFixed(2));

    const [booking] = await Booking.create(
      [
        {
          consultationId,
          userId: req.user._id,
          mode: selectedMode.mode,
          price: {
            inr: selectedMode.price.inr,
            usd: selectedMode.price.usd,
          },
          amount: finalAmount,
          currency,
          baseCurrency: "INR",
          baseAmount: payableInr,
          exchangeRate,
          gst: {
            rate: gst.rate,
            type: gst.type,
            taxableAmount: gst.base,
            amount: gst.taxAmount,
          },
          duration: consultation.duration,
          priceLabel: consultation.priceLabel,
          date: normalizedDate,
          slot: normalize(slot),
          status: "pending",
          paymentStatus: "pending",
        },
      ],
      { session },
    );

    if (!booking) throw new ApiError(400, "Failed to create booking");

    const [transaction] = await Transaction.create(
      [
        {
          user: req.user._id,
          booking: booking._id,
          transactionType: "consultation",
          amount: finalAmount,
          currency,
          baseCurrency: "INR",
          baseAmount: payableInr,
          exchangeRate,
          subTotal: finalAmount,
          shipping: 0,
          tax: convertedGstAmount,
          taxRate: gst.rate,
          taxInclusive: gst.type === "inclusive",
          discount: 0,
          method: "razorpay",
          status: "pending",
        },
      ],
      { session },
    );

    if (!transaction) throw new ApiError(400, "Failed to create transaction");

    const rzpOrder = await createRazorpayOrder({
      amount: finalAmount,
      currency,
      receipt: booking._id.toString(),
    });

    transaction.razorpayOrderId = rzpOrder.id;
    transaction.rawResponse = rzpOrder;
    await transaction.save({ session });

    booking.transactionId = transaction._id;
    await booking.save({ session });

    await session.commitTransaction();
    session.endSession();

    console.info(booking._id, rzpOrder.id, "Booking created");

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          booking,
          paymentRequired: true,
          razorpayConfig: {
            key: process.env.RAZORPAY_KEY_ID,
            orderId: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
          },
        },
        "Proceed to payment",
      ),
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    if (err?.code === 11000 && err?.message?.includes("date_1_slot_1")) {
      throw new ApiError(
        409,
        "This slot has already been booked. Please select another time slot.",
      );
    }
    throw err;
  }
});

export const verifyConsultationPayment = asyncHandler(async (req, res) => {
  const {
    bookingId,
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
  } = req.body;

  if (
    !bookingId ||
    !razorpay_payment_id ||
    !razorpay_order_id ||
    !razorpay_signature
  ) {
    throw new ApiError(400, "Missing required payment fields");
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    const booking = await Booking.findById(bookingId).lean();
    if (booking?.transactionId) {
      await Transaction.findByIdAndUpdate(booking.transactionId, {
        $set: { status: "failed" },
      });
    }
    throw new ApiError(400, "Invalid payment signature");
  }

  const booking = await Booking.findById(bookingId).lean();
  if (!booking) throw new ApiError(404, "Booking not found");

  const transaction = await Transaction.findById(booking.transactionId).lean();
  if (!transaction) throw new ApiError(404, "Transaction not found");

  if (transaction.razorpayOrderId !== razorpay_order_id) {
    throw new ApiError(400, "Order ID mismatch");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const claimed = await claimPaymentSuccess({
      bookingId,
      transactionId: booking.transactionId,
      razorpayPaymentId: razorpay_payment_id,
      session,
    });

    await session.commitTransaction();
    await session.endSession();

    if (!claimed) {
      // Webhook already processed this — return success, skip notification
      console.log(
        `BookingId: ${bookingId}`,
        "verifyConsultationPayment: webhook already claimed, skipping notification",
      );
      const alreadyPaid = await Booking.findById(bookingId).lean();
      return res
        .status(200)
        .json(new ApiResponse(200, alreadyPaid, "Payment already verified"));
    }

    console.log(bookingId, razorpay_payment_id, "Payment verified via client");

    // Only the winner enqueues — guaranteed no double notification
    enqueueBookingConfirmed(claimed);

    return res
      .status(200)
      .json(new ApiResponse(200, claimed, "Payment verified successfully"));
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});


export const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({
    userId: req.user._id,

    isDeleted: false,
  })
    // adminNotes is staff-only (see booking.model.js) — excluded here so it
    // never reaches the customer's own browser, not just hidden in the UI.
    .select("-adminNotes")
    .populate("consultationId")
    .sort({
      createdAt: -1,
    });

  return res.json(new ApiResponse(200, bookings, "My bookings fetched"));
});

export const getAllBookings = asyncHandler(async (req, res) => {
  const { fromDate, toDate, search } = req.query;

  const filter = { isDeleted: false, status: "booked", paymentStatus: "paid" };

  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (search) {
    const matchedUsers = await User.find({
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ],
    }).select("_id");

    filter.userId = { $in: matchedUsers.map((u) => u._id) };
  }

  const bookings = await Booking.find(filter)
    .populate("consultationId") // full data
    .populate("userId") // full data
    .sort({ createdAt: -1 });

  const formattedBookings = bookings.map((booking) => {
    const obj = booking.toObject();

    return {
      ...obj,
      consultation: obj.consultationId,
      customer: obj.userId,
      consultationId: undefined,
      userId: undefined,
    };
  });

  return res
    .status(200)
    .json(new ApiResponse(200, formattedBookings, "All bookings fetched"));
});
export const getBookingsByDate = asyncHandler(async (req, res) => {
  const { date } = req.query;

  if (!date) {
    throw new ApiError(400, "Date is required");
  }

  const bookings = await Booking.find({ date })
    .populate("consultationId")
    .populate("userId");

  return res
    .status(200)
    .json(new ApiResponse(200, bookings, "Bookings by date fetched"));
});

export const getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate("consultationId")
    .populate("userId");

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  return res.status(200).json(new ApiResponse(200, booking, "Booking fetched"));
});

export const deleteBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findById(id);

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (booking.isDeleted) {
    throw new ApiError(400, "Booking already deleted");
  }

  booking.isDeleted = true;
  booking.deletedAt = new Date();

  await booking.save();

  return res
    .status(200)
    .json(new ApiResponse(200, booking, "Booking deleted (soft)"));
});

export const downloadBookingInvoice = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const booking = await Booking.findOne({
    _id: bookingId,
    userId: req.user._id,
    isDeleted: false,
  })
    .populate("consultationId")
    .populate("userId")
    .populate("transactionId");

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (booking.paymentStatus !== "paid") {
    throw new ApiError(409, "Booking payment is not successful");
  }

  const transaction = booking.transactionId;
  if (
    !transaction ||
    typeof transaction !== "object" ||
    transaction.status !== "success"
  ) {
    throw new ApiError(409, "Successful Booking transaction not found");
  }

  const invoice = await findInvoiceForPdf({
    sourceType: "booking",
    sourceId: booking._id,
    transactionId: transaction._id,
  });
  const html = generateBookingInvoiceTemplate(
    booking,
    invoice?.invoiceNumber,
  );

  const browser = await puppeteer.connect({
    browserWSEndpoint: process.env.PDF_SERVER,
  });

  let pdfBuffer;

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });
  } finally {
    await browser.close();
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=booking-invoice-${bookingId}.pdf`,
  );

  return res.end(pdfBuffer);
});

export const rescheduleBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { date, slot, adminNote } = req.body;

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new ApiError(400, "Invalid booking id");
  }

  if (!date || !slot) {
    throw new ApiError(400, "Date and slot are required");
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    isDeleted: false,
  });

  const oldDate = booking.date;
  const oldSlot = booking.slot;

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (booking.status !== "booked") {
    throw new ApiError(400, "Only booked consultation can be rescheduled");
  }

  const { normalizedDate } = await validateBooking({
    consultationId: booking.consultationId,
    date,
    slot,
    isAdmin: true,
  });

  const normalizedSlot = normalize(slot);

  if (booking.date === normalizedDate && booking.slot === normalizedSlot) {
    throw new ApiError(400, "Please choose a different slot");
  }

  const existingBooking = await Booking.findOne({
    _id: { $ne: bookingId },
    consultationId: booking.consultationId,
    date: normalizedDate,
    slot: normalizedSlot,
    status: "booked",
    isDeleted: false,
  });

  if (existingBooking) {
    throw new ApiError(400, "Slot already booked");
  }

  const oldBooking = {
    date: booking.date,
    slot: booking.slot,
  };

  booking.date = normalizedDate;
  booking.slot = normalizedSlot;

  if (adminNote?.trim()) {
    booking.adminNotes.push({
      note: adminNote.trim(),
      action: "reschedule",
      addedBy: req.user?.fullName || req.user?.username,
    });
  }

  await booking.save();

  const populated = await Booking.findById(booking._id)
    .populate("consultationId")
    .populate("userId");

  const user = await User.findById(booking.userId);
  const consultation = await Consultation.findById(booking.consultationId);

  // TODO: Send Notification to user
  await notificationQueue.add("reschedule-booking", {
    bookingId: booking._id.toString(),
    userEmail: user?.email,
    userName: user?.firstName,
    userPhone: user?.phoneNumber,
    consultationTitle: consultation?.title,
    includes: consultation?.includes || [],
    mode: booking.mode,
    oldDate,
    oldSlot,
    newDate: booking.date,
    newSlot: booking.slot,
    amount: booking.amount,
    currency: booking.currency || "INR",
  });

  return res.json(
    new ApiResponse(
      200,
      {
        ...populated.toObject(),
        consultation: populated.consultationId,
        customer: populated.userId,
        consultationId: undefined,
        userId: undefined,
        oldBooking,
      },
      "Booking rescheduled successfully",
    ),
  );
});

export const updateBookingPlan = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { consultationId, mode, adminNote } = req.body;

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new ApiError(400, "Invalid booking id");
  }

  if (!consultationId || !mode) {
    throw new ApiError(400, "consultationId and mode are required");
  }

  const booking = await Booking.findOne({ _id: bookingId, isDeleted: false });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (booking.status !== "booked" || booking.paymentStatus !== "paid") {
    throw new ApiError(400, "Only paid bookings can be updated");
  }

  const consultation = await Consultation.findById(consultationId);

  if (!consultation) {
    throw new ApiError(404, "Consultation not found");
  }

  const normalizeStr = (s) => s?.toString().trim().toLowerCase();
  const selectedMode = consultation.modes.find(
    (m) => normalizeStr(m.mode) === normalizeStr(mode),
  );

  if (!selectedMode) {
    throw new ApiError(400, "Invalid mode for selected consultation");
  }

  const newPriceInr = selectedMode.price?.inr || 0;
  const gst = computeGst(newPriceInr, selectedMode.gst);
  const newPayableInr = gst.total;
  const newAmount =
    selectedMode.price?.[booking.currency?.toLowerCase()] ??
    Number((newPayableInr * (booking.exchangeRate || 1)).toFixed(2));

  booking.consultationId = consultation._id;
  booking.mode = selectedMode.mode;
  booking.price = {
    inr: selectedMode.price?.inr,
    usd: selectedMode.price?.usd,
  };
  booking.amount = newAmount;
  booking.baseAmount = newPayableInr;
  booking.gst = {
    rate: gst.rate,
    type: gst.type,
    taxableAmount: gst.base,
    amount: gst.taxAmount,
  };
  booking.duration = consultation.duration;
  booking.priceLabel = consultation.priceLabel;

  if (adminNote?.trim()) {
    booking.adminNotes.push({
      note: adminNote.trim(),
      action: "plan_change",
      addedBy: req.user?.fullName || req.user?.username,
    });
  }

  await booking.save();

  // Keep the linked Transaction's amount/GST in sync with the booking's new
  // plan — the GST report reads from Transaction, not Booking, so leaving it
  // stale here caused the report to keep showing the pre-upgrade amount
  // while the Dashboard (which reads Booking directly) showed the new one.
  // A legacy booking that predates transaction linking gets one created here
  // instead of silently staying unrecorded.
  const transactionUpdate = {
    amount: newAmount,
    baseAmount: newPayableInr,
    subTotal: newAmount,
    tax: gst.taxAmount,
    taxRate: gst.rate,
    taxInclusive: gst.type === "inclusive",
  };

  if (booking.transactionId) {
    await Transaction.findByIdAndUpdate(booking.transactionId, {
      $set: transactionUpdate,
    });
  } else {
    const transaction = await Transaction.create({
      user: booking.userId,
      booking: booking._id,
      transactionType: "consultation",
      currency: booking.currency || "INR",
      baseCurrency: booking.baseCurrency || "INR",
      exchangeRate: booking.exchangeRate || 1,
      shipping: 0,
      discount: 0,
      method: "manual",
      status: "success",
      ...transactionUpdate,
    });

    booking.transactionId = transaction._id;
    await booking.save();
  }

  const populated = await Booking.findById(booking._id)
    .populate("consultationId")
    .populate("userId");

  const user = await User.findById(booking.userId);

  await notificationQueue.add("booking-upgraded", {
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

  return res.json(
    new ApiResponse(
      200,
      {
        ...populated.toObject(),
        consultation: populated.consultationId,
        customer: populated.userId,
        consultationId: undefined,
        userId: undefined,
      },
      "Booking plan updated successfully",
    ),
  );
});

export const createAdminBooking = asyncHandler(async (req, res) => {
  const result = bookingZod.safeParse(req.body);

  if (!result.success) {
    const errors = result.error?.issues?.map((e) => e.message) || [
      "Invalid input",
    ];
    throw new ApiError(400, errors.join(", "));
  }

  const {
    consultationId,
    mode,
    date,
    slot,
    userId,
    name,
    email,
    phone,
    discountType,
    discountValue,
    note,
  } = result.data;

  let finalUserId = userId;

  if (userId) {
    const user = await User.findById(userId);

    if (!user) throw new ApiError(404, "User not found");
  } else {
    if (!name || !phone) {
      throw new ApiError(400, "Name & phone required");
    }

    const newUser = await User.create({
      firstName: name,
      ...(email ? { email } : {}),
      phoneNumber: phone,
      username: `user_${Date.now()}`,
      password: "Temp@123",
    });

    finalUserId = newUser._id;
  }

  const { consultation, normalizedDate } = await validateBooking({
    consultationId,
    date,
    slot,
    isAdmin: true,
  });

  const normalize = (s) => s?.toString().trim().toLowerCase();

  const selectedMode = consultation.modes.find(
    (m) => normalize(m.mode) === normalize(mode),
  );

  if (!selectedMode) {
    throw new ApiError(400, "Invalid mode selected");
  }

  const existing = await Booking.findOne({
    consultationId,
    mode: selectedMode.mode,
    date: normalizedDate,
    slot: normalize(slot),
    status: "booked",
    isDeleted: false,
  });

  if (existing) {
    throw new ApiError(400, "Slot already booked for this mode");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  let transactionCommitted = false;

  try {
    const priceInr = selectedMode.price?.inr || 0;

    let discountAmount = 0;

    if (discountType && discountValue) {
      discountAmount =
        discountType === "PERCENTAGE"
          ? (priceInr * discountValue) / 100
          : discountValue;

      discountAmount = Math.min(
        Math.round(discountAmount * 100) / 100,
        priceInr,
      );
    }

    const taxableInr = Math.max(0, priceInr - discountAmount);
    const gst = computeGst(taxableInr, selectedMode.gst);
    const payableInr = gst.total;

    const [booking] = await Booking.create([{
      consultationId,
      userId: finalUserId,

      mode: selectedMode.mode,

      price: {
        inr: selectedMode.price.inr,
        usd: selectedMode.price.usd,
      },

      amount: payableInr,
      currency: "INR",
      baseCurrency: "INR",
      baseAmount: payableInr,
      exchangeRate: 1,
      gst: {
        rate: gst.rate,
        type: gst.type,
        taxableAmount: gst.base,
        amount: gst.taxAmount,
      },

      duration: consultation.duration,
      priceLabel: consultation.priceLabel,

      discountType: discountAmount > 0 ? discountType : null,
      discountValue: discountAmount > 0 ? discountValue : 0,
      discountAmount,

      date: normalizedDate,
      slot: normalize(slot),

      status: "booked",
      paymentStatus: "paid",
      bookingSource: "admin",

      note: note || undefined,
    }], { session });

    // Admin-created bookings are marked paid immediately (no Razorpay
    // checkout), but still need a Transaction record — the GST report reads
    // only from Transaction, while the Dashboard revenue total reads
    // straight from Booking. Without this, admin bookings inflated the
    // Dashboard total but never showed up in the GST report.
    const [transaction] = await Transaction.create([{
      user: finalUserId,
      booking: booking._id,
      transactionType: "consultation",
      amount: payableInr,
      currency: "INR",
      baseCurrency: "INR",
      baseAmount: payableInr,
      exchangeRate: 1,
      subTotal: payableInr,
      shipping: 0,
      tax: gst.taxAmount,
      taxRate: gst.rate,
      taxInclusive: gst.type === "inclusive",
      discount: discountAmount,
      method: "manual",
      status: "success",
    }], { session });

    booking.transactionId = transaction._id;
    await booking.save({ session });

    await allocateInvoiceInTransaction({
      sourceType: "booking",
      sourceId: booking._id,
      transactionId: transaction._id,
      session,
    });

    await session.commitTransaction();
    transactionCommitted = true;
    await session.endSession();

    const populated = await Booking.findById(booking._id)
      .populate("consultationId")
      .populate("userId");

    enqueueBookingConfirmed(booking);

    return res.json(
      new ApiResponse(
        200,
        {
          ...populated.toObject(),
          consultation: populated.consultationId,
          customer: populated.userId,
          consultationId: undefined,
          userId: undefined,
        },
        "Booking successful",
      ),
    );
  } catch (err) {
    if (!transactionCommitted) {
      await session.abortTransaction();
      await session.endSession();
    }

    if (err.code === 11000) {
      throw new ApiError(400, "Slot already booked");
    }

    throw err;
  }
});
