import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import { Booking } from "../modules/booking/booking.model.js";
import { Order } from "../modules/Order/order.model.js";
import ReportOrder from "../modules/Reports/reportOrder.model.js";
import { Transaction } from "../modules/Transaction/Transaction.model.js";

dotenv.config();

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Read-only diagnostic: replicates the Dashboard's all-time revenue sum
// (Booking/Order/ReportOrder, matching setting.controller.js's exact filters)
// side by side with the GST report's sum for the SAME underlying records
// (via each record's linked Transaction, matching Transaction.controler.js's
// getGstReport logic — status defaults to "success"), and prints every
// record where the two disagree, so the exact source of the gap is visible
// instead of guessed at.
async function diagnose() {
  await connectDB();

  const mismatches = [];
  let dashboardTotal = 0;
  let gstTotal = 0;

  // ── Bookings ──────────────────────────────────────────────────────────
  const bookings = await Booking.find({
    status: "booked",
    paymentStatus: "paid",
    isDeleted: false,
  }).lean();

  for (const b of bookings) {
    const dashboardAmount = round2(b.baseAmount > 0 ? b.baseAmount : b.amount || 0);
    dashboardTotal += dashboardAmount;

    const txn = b.transactionId
      ? await Transaction.findById(b.transactionId).lean()
      : await Transaction.findOne({ booking: b._id }).lean();

    let gstAmount = 0;
    let note = "";
    if (!txn) {
      note = "NO TRANSACTION";
    } else if (txn.status !== "success") {
      note = `txn.status="${txn.status}"`;
    } else {
      gstAmount = round2(txn.baseAmount > 0 ? txn.baseAmount : txn.amount || 0);
    }
    gstTotal += gstAmount;

    const diff = round2(dashboardAmount - gstAmount);
    if (Math.abs(diff) > 0.01) {
      mismatches.push({
        type: "booking",
        id: b._id.toString(),
        dashboardAmount,
        gstAmount,
        diff,
        note,
        createdAt: b.createdAt,
      });
    }
  }

  // ── Orders ────────────────────────────────────────────────────────────
  const orders = await Order.find({ "payment.status": "paid" }).lean();

  for (const o of orders) {
    const dashboardAmount = round2(o.totalAmount || 0);
    dashboardTotal += dashboardAmount;

    const txn = await Transaction.findOne({ order: o._id }).lean();

    let gstAmount = 0;
    let note = "";
    if (!txn) {
      note = "NO TRANSACTION";
    } else if (txn.status !== "success") {
      note = `txn.status="${txn.status}"`;
    } else {
      gstAmount = round2(txn.amount || 0);
    }
    gstTotal += gstAmount;

    const diff = round2(dashboardAmount - gstAmount);
    if (Math.abs(diff) > 0.01) {
      mismatches.push({
        type: "order",
        id: o._id.toString(),
        dashboardAmount,
        gstAmount,
        diff,
        note,
        createdAt: o.createdAt,
      });
    }
  }

  // ── Report orders ─────────────────────────────────────────────────────
  const reportOrders = await ReportOrder.find({ paymentStatus: "paid" }).lean();

  for (const r of reportOrders) {
    const dashboardAmount = round2(r.baseAmount > 0 ? r.baseAmount : r.amount || 0);
    dashboardTotal += dashboardAmount;

    const txn = await Transaction.findOne({ report: r._id }).lean();

    let gstAmount = 0;
    let note = "";
    if (!txn) {
      note = "NO TRANSACTION";
    } else if (txn.status !== "success") {
      note = `txn.status="${txn.status}"`;
    } else {
      gstAmount = round2(txn.baseAmount > 0 ? txn.baseAmount : txn.amount || 0);
    }
    gstTotal += gstAmount;

    const diff = round2(dashboardAmount - gstAmount);
    if (Math.abs(diff) > 0.01) {
      mismatches.push({
        type: "reportOrder",
        id: r._id.toString(),
        dashboardAmount,
        gstAmount,
        diff,
        note,
        createdAt: r.createdAt,
      });
    }
  }

  console.log(`\nDashboard-style total: ${round2(dashboardTotal)}`);
  console.log(`GST-style total:       ${round2(gstTotal)}`);
  console.log(`Gap:                   ${round2(dashboardTotal - gstTotal)}\n`);

  mismatches.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  console.log(`${mismatches.length} mismatched record(s):\n`);
  for (const m of mismatches) {
    console.log(
      `[${m.type}] ${m.id}  dashboard=${m.dashboardAmount}  gst=${m.gstAmount}  diff=${m.diff}  ${m.note}  (${new Date(m.createdAt).toISOString().slice(0, 10)})`,
    );
  }

  await mongoose.disconnect();
}

diagnose().catch((err) => {
  console.error("Diagnosis failed:", err);
  process.exit(1);
});
