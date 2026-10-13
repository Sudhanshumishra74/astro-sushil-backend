import { Transaction } from "./Transaction.model.js";
import { User } from "../auth/user.modal.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseDateIST } from "../../utils/time.js";

export const getAllTransactions = asyncHandler(async (req, res) => {
  const { status, method, fromDate, toDate, search, page = 1, limit = 10 } = req.query;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};

  if (status) filter.status = status;
  if (method) filter.method = method;

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

    filter.user = { $in: matchedUsers.map((u) => u._id) };
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .populate("user", "firstName lastName email phoneNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Transaction.countDocuments(filter),
  ]);

  return res.json(
    new ApiResponse(200, {
      transactions,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    }, "Transactions fetched")
  );
});

const SUPPLIER_STATE = "Uttar Pradesh";

const invoiceNumberFor = (txn) => {
  const linkedId = txn.order?._id || txn.booking?._id || txn.report?._id;
  return `INV-${String(linkedId || txn._id).slice(-8).toUpperCase()}`;
};

const customerNameFor = (txn) => {
  if (txn.transactionType === "report" && txn.report) {
    if (txn.report.reportType === "match_making_pdf") {
      const bride = txn.report.matchMakingDetails?.bride?.fullName;
      const groom = txn.report.matchMakingDetails?.groom?.fullName;
      return [bride, groom].filter(Boolean).join(" & ") || "—";
    }
    if (txn.report.customerDetails?.fullName) {
      return txn.report.customerDetails.fullName;
    }
  }
  if (txn.user) {
    const name = `${txn.user.firstName || ""} ${txn.user.lastName || ""}`.trim();
    return name || txn.user.email || "—";
  }
  return "—";
};

// Place of supply: delivery state for physical orders; every other flow
// (digital orders, consultations, reports) has no recipient state on
// record, so it defaults to the supplier's own state per Sec 12(2) IGST Act.
const placeOfSupplyFor = (txn) => txn.order?.shippingAddress?.state || SUPPLIER_STATE;

// Order transactions can bundle items taxed at different GST rates; call
// that out explicitly rather than showing a single (possibly wrong) rate.
// "0%" is only used when we're sure no tax applies — records placed before
// GST was added to the platform carry a real `tax` total (from the older,
// pre-GST calculation) but no per-item/transaction taxRate. Those charged
// the standard 18% exclusive slab, so that combo is reported as such
// instead of a misleading 0%.
const PRE_GST_RATE = 18;
const PRE_GST_TYPE = "Exclusive";

const gstRateLabelFor = (txn) => {
  if (txn.transactionType === "order") {
    const rates = [
      ...new Set(
        (txn.order?.items || [])
          .filter((i) => (i.taxRate || 0) > 0)
          .map((i) => i.taxRate),
      ),
    ];
    if (rates.length === 1) return `${rates[0]}%`;
    if (rates.length > 1) return `Mixed (${rates.join("/")}%)`;
    return (txn.tax || 0) > 0 ? `${PRE_GST_RATE}%` : "0%";
  }
  return (txn.taxRate || 0) > 0
    ? `${txn.taxRate}%`
    : (txn.tax || 0) > 0
      ? `${PRE_GST_RATE}%`
      : "0%";
};

// Whether the GST is baked into the item price (inclusive) or added on top
// (exclusive) — same pre-GST/mixed handling as the rate label above.
const gstTypeLabelFor = (txn) => {
  if (txn.transactionType === "order") {
    const types = [
      ...new Set(
        (txn.order?.items || [])
          .filter((i) => (i.taxRate || 0) > 0)
          .map((i) => (i.taxType === "inclusive" ? "Inclusive" : "Exclusive")),
      ),
    ];
    if (types.length === 1) return types[0];
    if (types.length > 1) return "Mixed";
    return (txn.tax || 0) > 0 ? PRE_GST_TYPE : "—";
  }
  if ((txn.tax || 0) <= 0) return "—";
  return (txn.taxRate || 0) > 0
    ? txn.taxInclusive
      ? "Inclusive"
      : "Exclusive"
    : PRE_GST_TYPE;
};

export const getGstReport = asyncHandler(async (req, res) => {
  const { fromDate, toDate, status = "success", transactionType } = req.query;

  const filter = {};

  if (status) filter.status = status;
  if (transactionType) filter.transactionType = transactionType;

  // Date bounds are interpreted as IST calendar days (the business's and
  // the admin's own timezone), not UTC — the platform runs on a UTC host,
  // so a raw UTC day boundary here would silently swallow a chunk of the
  // last evening of the range (IST is UTC+5:30) and misfile it into the
  // next month, e.g. picking "June" would still include records from the
  // first ~5.5 hours of July 1st IST.
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) {
      const start = parseDateIST(fromDate);
      if (start) filter.createdAt.$gte = start.toDate();
    }
    if (toDate) {
      const end = parseDateIST(toDate);
      if (end) filter.createdAt.$lte = end.endOf("day").toDate();
    }
  }

  // Intentionally NOT filtering out soft-deleted bookings (Booking.isDeleted)
  // or otherwise re-checking the linked Order/Booking/ReportOrder's current
  // status here, unlike the admin Dashboard's revenue total. This report is
  // the tax record of what was actually collected at time of sale — deleting
  // an internal booking record later doesn't undo a completed transaction,
  // so it must stay in the GST filing even though it drops out of the
  // Dashboard's (deliberately narrower) live-bookings revenue figure.
  const transactions = await Transaction.find(filter)
    .populate("user", "firstName lastName email phoneNumber")
    .populate({ path: "order", select: "shippingAddress items orderStatus" })
    .populate({ path: "booking", select: "" })
    .populate({
      path: "report",
      select: "customerDetails matchMakingDetails reportType reportStatus",
    })
    .sort({ createdAt: 1 })
    .lean();

  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  const rows = transactions.map((txn) => {
    // Bookings/reports can be paid in a non-INR currency; `subTotal`/`tax`
    // are stored in that paid currency, but `baseAmount` is meant to be the
    // INR equivalent (same as the Dashboard uses for these two types). Some
    // older report transactions never had `baseAmount` populated at all
    // (defaults to 0) — fall back to the raw `amount` rather than trusting
    // a zeroed-out field, same fallback the Dashboard's own aggregation uses.
    const isBookingOrReport =
      txn.transactionType === "consultation" || txn.transactionType === "report";
    const rate = txn.exchangeRate || 1;

    const totalAmount = isBookingOrReport
      ? txn.baseAmount > 0
        ? txn.baseAmount
        : txn.amount || 0
      : txn.amount || 0;
    const gstAmount = isBookingOrReport
      ? round2((txn.tax || 0) / rate)
      : txn.tax || 0;
    // Derived as totalAmount - gstAmount (not txn.subTotal) so it nets out
    // discounts and includes shipping, keeping taxableAmount + gstAmount ==
    // totalAmount for every row — subTotal alone is pre-discount and once
    // undercut Grand Total by the sum of all coupon discounts applied.
    const taxableAmount = round2(Math.max(totalAmount - gstAmount, 0));

    return {
      transactionId: txn._id,
      date: txn.createdAt,
      invoiceNo: invoiceNumberFor(txn),
      type: txn.transactionType,
      customerName: customerNameFor(txn),
      customerEmail: txn.user?.email || "",
      customerPhone: txn.user?.phoneNumber || "",
      placeOfSupply: placeOfSupplyFor(txn),
      taxableAmount,
      gstRateLabel: gstRateLabelFor(txn),
      gstType: gstTypeLabelFor(txn),
      gstAmount,
      totalAmount,
      currency: isBookingOrReport ? "INR" : txn.currency || "INR",
      paymentMethod: txn.method,
      paymentStatus: txn.status,
      razorpayTransactionId: txn.transactionId || "",
    };
  });

  const summary = rows.reduce(
    (acc, r) => {
      acc.taxableTotal += r.taxableAmount;
      acc.gstTotal += r.gstAmount;
      acc.grandTotal += r.totalAmount;
      return acc;
    },
    { taxableTotal: 0, gstTotal: 0, grandTotal: 0, count: rows.length },
  );

  return res.json(
    new ApiResponse(200, { rows, summary }, "GST report fetched"),
  );
});