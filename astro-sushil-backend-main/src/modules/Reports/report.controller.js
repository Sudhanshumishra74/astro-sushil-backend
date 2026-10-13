import crypto from "crypto";
import Report from "./report.model.js";
import ReportOrder from "./reportOrder.model.js";
import { Transaction } from "../Transaction/Transaction.model.js";
import puppeteer from "puppeteer";
import { User } from "../auth/user.modal.js";

import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { generateReportInvoiceTemplate } from "../../utils/generateReportInvoiceTemplate.js";

import {
  createReportSchema,
  updateReportSchema,
  buyReportSchema,
  verifyReportPaymentSchema,
} from "./report.validation.js";
import { uploadFile } from "../../service/UploadAws.js";
import { notificationQueue } from "../../queues/notification.queue.js";
import { astrologyApiRequest, getUserBalance } from "../../service/astroApi.js";
import { processReportPDFQueue } from "../../queues/process-report-pdf.queue.js";
import { REPORT_CONFIG } from "../../utils/constants.js";
import { normalizeDate } from "../../utils/time.js";
import { createRazorpayOrder } from "../../utils/razorpay.js";
import { computeGst } from "../../common/taxEngine.js";

const resolveReportGst = (report) => computeGst(report.salePrice, report.gst);

export const addReport = asyncHandler(async (req, res) => {
  console.log("=== Incoming req.body ===");
  console.log(req.body);

  console.log("=== Incoming req.file ===");
  console.log(req.file);

  const existingReport = await Report.findOne({
    slug: req.body.slug,
  });

  if (existingReport) {
    throw new ApiError(400, "Report slug already exists");
  }

  let coverImage = "";

  if (req.file) {
    const uploaded = await uploadFile({
      file: req.file,
    });

    coverImage = uploaded.url;
  }

  const body = {
    ...req.body,
    coverImage,
    benefits: JSON.parse(req.body.benefits || "[]"),
    features: JSON.parse(req.body.features || "[]"),
    gst: req.body.gst ? JSON.parse(req.body.gst) : undefined,
  };

  console.log("=== Parsed Body Before Validation ===");
  console.log(body);

  const parsed = createReportSchema.safeParse(body);

  if (!parsed.success) {
    console.log("=== Zod Validation Error ===");
    console.log(parsed.error.issues);
    console.log(JSON.stringify(parsed.error.format(), null, 2));

    throw new ApiError(400, "Invalid input");
  }

  console.log("=== Validated Data ===");
  console.log(parsed.data);

  const report = await Report.create(parsed.data);

  return res.json(new ApiResponse(201, report, "Report created successfully"));
});

export const getReports = asyncHandler(async (req, res) => {
  const reports = await Report.find({ isActive: true }).sort({
    createdAt: -1,
  });

  return res.json(
    new ApiResponse(200, reports, "Reports fetched successfully"),
  );
});

export const getReportById = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    throw new ApiError(404, "Report not found");
  }

  const gst = resolveReportGst(report);

  return res.json(
    new ApiResponse(
      200,
      { ...report.toObject(), priceBreakdown: gst },
      "Report fetched successfully",
    ),
  );
});

export const getReportBySlug = asyncHandler(async (req, res) => {
  const report = await Report.findOne({
    slug: req.params.slug,
    isActive: true,
  });

  if (!report) {
    throw new ApiError(404, "Report not found");
  }

  const gst = resolveReportGst(report);

  return res.json(
    new ApiResponse(
      200,
      { ...report.toObject(), priceBreakdown: gst },
      "Report fetched successfully",
    ),
  );
});

export const updateReport = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    throw new ApiError(404, "Report not found");
  }

  let coverImage = report.coverImage;

  if (req.file) {
    const uploaded = await uploadFile({
      file: req.file,
    });

    coverImage = uploaded.url;
  }

  const body = {
    ...req.body,
    coverImage,
    benefits: req.body.benefits
      ? JSON.parse(req.body.benefits)
      : report.benefits,
    features: req.body.features
      ? JSON.parse(req.body.features)
      : report.features,
    gst: req.body.gst ? JSON.parse(req.body.gst) : undefined,
  };

  const parsed = updateReportSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid input");
  }

  // Use assign + save (not findByIdAndUpdate) so the pre-save hook that
  // recomputes priceWithGst from salePrice/gst actually runs.
  Object.assign(report, parsed.data);
  await report.save();

  return res.json(
    new ApiResponse(200, report, "Report updated successfully"),
  );
});

export const deleteReport = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    throw new ApiError(404, "Report not found");
  }

  await report.deleteOne();

  return res.json(new ApiResponse(200, null, "Report deleted successfully"));
});

export const buyReport = asyncHandler(async (req, res) => {
  const parsed = buyReportSchema.safeParse(req.body);

  if (!parsed.success) {
    console.log("=== ZOD ERROR ===");
    console.log(JSON.stringify(parsed.error.format(), null, 2));
    throw new ApiError(400, "Invalid input");
  }

  console.log("=== PARSED DATA ===", parsed.data);

  const {
    reportId,
    reportType,
    currency = "INR",
    currencyRate = 1,
    customerDetails,
    matchMakingDetails,
  } = parsed.data;

  const balance = await getUserBalance();

  if (balance < 300) {
    throw new ApiError(
      400,
      "Insufficient balance. Please recharge your account.",
    );
  }

  console.log("CUSTOMER DETAILS", customerDetails);

  const report = await Report.findOne({
    _id: reportId,
    isActive: true,
  });

  if (!report) {
    throw new ApiError(404, "Report not found");
  }

  // Each report carries its own GST config — inclusive means the charge
  // is unchanged (tax backed out of salePrice for records); exclusive means
  // tax is added on top, increasing the actual charge.
  const gst = resolveReportGst(report);
  const payableInr = gst.total;
  const convertedAmount = Number((payableInr * currencyRate).toFixed(2));
  const convertedTaxableAmount = Number((gst.base * currencyRate).toFixed(2));
  const convertedGstAmount = Number((gst.taxAmount * currencyRate).toFixed(2));

  console.log("=== PAYMENT INFO ===", {
    baseAmount: payableInr,
    gst,
    convertedAmount,
    currency,
    currencyRate,
  });

  const razorpayOrder = await createRazorpayOrder({
    amount: convertedAmount,
    currency,
    receipt: `report_${Date.now()}`,
  });

  console.log("=== RAZORPAY ORDER ===", razorpayOrder);

  // BASE ORDER PAYLOAD
  const orderPayload = {
    userId: req.user?._id || null,
    reportId: report._id,
    baseAmount: payableInr,
    amount: convertedAmount,
    currency,
    currencyRate,
    gst: {
      rate: gst.rate,
      type: gst.type,
      taxableAmount: convertedTaxableAmount,
      amount: convertedGstAmount,
    },
    razorpayOrderId: razorpayOrder.id,
    paymentStatus: "pending",
    reportType,
  };

  // CASE 1: NORMAL REPORT
  if (reportType !== "match_making_pdf") {
    orderPayload.customerDetails = customerDetails;
  }

  // CASE 2: MATCHMAKING REPORT
  if (reportType === "match_making_pdf") {
    orderPayload.matchMakingDetails = matchMakingDetails;
  }

  const order = await ReportOrder.create(orderPayload);

  console.log("=== ORDER CREATED ===", order);

  const transaction = await Transaction.create({
    user: req.user?._id || null,
    report: order._id,
    transactionType: "report",
    amount: order.amount,
    currency: order.currency,
    baseAmount: payableInr,
    baseCurrency: "INR",
    exchangeRate: currencyRate,
    subTotal: convertedTaxableAmount,
    tax: convertedGstAmount,
    taxRate: gst.rate,
    taxInclusive: gst.type === "inclusive",
    razorpayOrderId: order.razorpayOrderId,
    method: "razorpay",
  });

  return res.json(
    new ApiResponse(
      200,
      {
        order,
        razorpayConfig: {
          key: process.env.RAZORPAY_KEY_ID,
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
        },
      },
      "Report order created successfully",
    ),
  );
});

export async function generateReportAfterPayment(order) {
  let result;

  if (order.reportType === "match_making_pdf") {
    const { bride, groom, reportLanguage } = order.matchMakingDetails;
    const brideDob = new Date(bride.dateOfBirth);
    const groomDob = new Date(groom.dateOfBirth);

    result = await astrologyApiRequest({
      path: `reports/${order.reportId.reportType}`,
      body: {
        f_first_name: bride.fullName.split(" ")[0],
        f_last_name: bride.fullName.split(" ").slice(1).join(" ") || "",
        f_day: brideDob.getDate(),
        f_month: brideDob.getMonth() + 1,
        f_year: brideDob.getFullYear(),
        f_hour: Number(bride.timeOfBirth.split(":")[0]),
        f_minute: Number(bride.timeOfBirth.split(":")[1]),
        f_latitude: Number(bride.latitude),
        f_longitude: Number(bride.longitude),
        f_timezone: bride.timezone ?? 5.5,
        f_place: bride.birthPlace,
        m_first_name: groom.fullName.split(" ")[0],
        m_last_name: groom.fullName.split(" ").slice(1).join(" ") || "",
        m_day: groomDob.getDate(),
        m_month: groomDob.getMonth() + 1,
        m_year: groomDob.getFullYear(),
        m_hour: Number(groom.timeOfBirth.split(":")[0]),
        m_minute: Number(groom.timeOfBirth.split(":")[1]),
        m_latitude: Number(groom.latitude),
        m_longitude: Number(groom.longitude),
        m_timezone: groom.timezone ?? 5.5,
        m_place: groom.birthPlace,
        language: reportLanguage || "en",
        ashtakoot: false,
        dashakoot: false,
        papasamyam: false,
        chart_style: "NORTH_INDIAN",
        footer_link: "https://astrosushil.com",
        logo_url: "https://astrosushil.com/logo/logo.webp",
        company_name: "Astro Sushil",
        company_info:
          "Astro Sushil is a leading astrology service provider offering personalized horoscope reports.",
        domain_url: "https://astrosushil.com",
        company_email: "connect@astrosushil.com",
        company_landline: "6393551359",
        company_mobile: "6393551359",
      },
    });
  } else {
    const customer = order.customerDetails;

    result = await astrologyApiRequest({
      path: `reports/${order.reportId.reportType}`,
      body: {
        name: customer.fullName,
        gender: customer.gender,
        day: new Date(customer.dateOfBirth).getDate(),
        month: new Date(customer.dateOfBirth).getMonth() + 1,
        year: new Date(customer.dateOfBirth).getFullYear(),
        hour: Number(customer.timeOfBirth.split(":")[0]),
        min: Number(customer.timeOfBirth.split(":")[1]),
        language: customer.reportLanguage || "en",
        place: customer.birthPlace,
        lat: Number(customer.latitude),
        lon: Number(customer.longitude),
        tzone: 5.5,
        chart_style: "NORTH_INDIAN",
        footer_link: "https://astrosushil.com",
        logo_url: "https://astrosushil.com/logo/logo.webp",
        company_name: "Astro Sushil",
        company_info:
          "Astro Sushil is a leading astrology service provider offering personalized horoscope reports.",
        domain_url: "https://astrosushil.com",
        company_email: "connect@astrosushil.com",
        company_landline: "6393551359",
        company_mobile: "6393551359",
      },
    });
  }

  if (!result) {
    throw new Error(
      "Report generation failed — astrology API returned empty result",
    );
  }

  order.reportStatus = "processing";
  order.reportUrl = result.reportLink.pdf_url;
  await order.save();

  const cfg = REPORT_CONFIG[order.reportType] || {};
  const userData =
    order.reportType === "match_making_pdf"
      ? {
          name: order.matchMakingDetails?.bride?.fullName || "",
          dob:
            normalizeDate(order.matchMakingDetails?.bride?.dateOfBirth) || "",
          birthTime: order.matchMakingDetails?.bride?.timeOfBirth || "",
        }
      : {
          name: order.customerDetails?.fullName || "",
          dob: normalizeDate(order.customerDetails?.dateOfBirth) || "",
          birthTime: order.customerDetails?.timeOfBirth || "",
        };

  await processReportPDFQueue.add("process-report-pdf", {
    reportOrderId: order._id.toString(),
    sourceUrl: order.reportUrl,
    frontBgUrl: cfg.frontPageBg || order.reportId?.coverImage || "",
    lastBgUrl: cfg.lastPageBg || order.reportId?.coverImage || "",
    userData,
  });
}

// Match-making orders have no single "customer" contact of their own —
// only bride/groom details — but the buyer (order.userId, always set since
// /reports/buy requires verifyToken) isn't necessarily the bride, so the
// payment/report-ready notification must go to whoever actually paid, not
// unconditionally to the bride. Falls back to the bride's contact only if
// userId somehow isn't populated. Non-matchmaking reports still use
// customerDetails, filled in by the purchaser themselves.
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

export const verifyReportPayment = asyncHandler(async (req, res) => {
  const parsed = verifyReportPaymentSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid input");
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    parsed.data;

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (generatedSignature !== razorpay_signature) {
    await Promise.all([
      ReportOrder.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { $set: { paymentStatus: "failed" } },
      ),
      Transaction.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { $set: { status: "failed" } },
      ),
    ]);
    throw new ApiError(400, "Payment verification failed");
  }

  // Atomic claim — only client or webhook runs report generation, never both
  const claimed = await ReportOrder.findOneAndUpdate(
    { razorpayOrderId: razorpay_order_id, paymentStatus: { $ne: "paid" } },
    {
      $set: {
        paymentStatus: "paid",
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      },
    },
    { new: true },
  ).populate(["reportId", "userId"]);

  await Transaction.findOneAndUpdate(
    { razorpayOrderId: razorpay_order_id },
    { $set: { status: "success", transactionId: razorpay_payment_id } },
  );

  if (!claimed) {
    // Webhook already claimed and triggered report generation
    console.info(
      { razorpayOrderId: razorpay_order_id },
      "verifyReportPayment: webhook already claimed, skipping generation",
    );
    const existing = await ReportOrder.findOne({
      razorpayOrderId: razorpay_order_id,
    });
    return res.json(new ApiResponse(200, existing, "Payment already verified"));
  }

  await generateReportAfterPayment(claimed);

  notificationQueue
    .add(
      "report-order-confirmed",
      {
        reportOrderId: claimed._id.toString(),
        userEmail: getReportOrderEmail(claimed),
        userName: getReportOrderName(claimed),
        userPhone: getReportOrderPhone(claimed),
        reportName: claimed.reportId?.name || "Kundali Report",
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    )
    .catch((err) =>
      console.error(
        { reportOrderId: claimed._id, err },
        "verifyReportPayment: failed to enqueue notification",
      ),
    );

  return res.json(
    new ApiResponse(200, claimed, "Payment verified successfully"),
  );
});

export const downloadReportInvoice = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await ReportOrder.findOne({
    _id: orderId,
    userId: req.user._id,
  })
    .populate("reportId")
    .lean();

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const transaction = await Transaction.findOne({ report: order._id }).lean();
  const user = await User.findById(req.user._id).select(
    "firstName lastName email phoneNumber",
  );

  const html = generateReportInvoiceTemplate({ order, transaction, user });

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
    `attachment; filename=report-invoice-${orderId}.pdf`,
  );

  return res.end(pdfBuffer);
});

export const getReportOrders = asyncHandler(async (req, res) => {
  const orders = await ReportOrder.find({
    userId: req.user._id,
    reportStatus: "completed",
    isReportSent: true,
  }).populate("reportId");

  return res.json(
    new ApiResponse(200, orders, "Report orders fetched successfully"),
  );
});

export const getAllReportOrders = asyncHandler(async (req, res) => {
  const {
    fromDate,
    toDate,
    page = 1,
    limit = 10,
    search,
    reportType,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};

  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (reportType) {
    filter.reportType = reportType;
  }

  if (search) {
    const matchedUsers = await User.find({
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ],
    }).select("_id");

    filter.$or = [
      { "customerDetails.fullName": { $regex: search, $options: "i" } },
      { "customerDetails.whatsappNumber": { $regex: search, $options: "i" } },
      { "matchMakingDetails.bride.fullName": { $regex: search, $options: "i" } },
      { "matchMakingDetails.bride.whatsappNumber": { $regex: search, $options: "i" } },
      { userId: { $in: matchedUsers.map((u) => u._id) } },
    ];
  }

  const [orders, total] = await Promise.all([
    ReportOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("reportId")
      .populate("userId", "firstName lastName email phoneNumber"),
    ReportOrder.countDocuments(filter),
  ]);

  return res.json(
    new ApiResponse(
      200,
      {
        orders,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      "Report orders fetched successfully",
    ),
  );
});
