import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import { Booking } from "../modules/booking/booking.model.js";
import { Order } from "../modules/Order/order.model.js";
import ReportOrder from "../modules/Reports/reportOrder.model.js";
import { Transaction } from "../modules/Transaction/Transaction.model.js";

dotenv.config();

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// The previous diagnostic (diagnoseGstDashboardGap) walks the Dashboard's
// side (currently-qualifying Booking/Order/ReportOrder records) and checks
// each one's linked Transaction — it can only ever find cases where GST is
// MISSING revenue the Dashboard counts. It can't find the opposite: a
// "success" Transaction the GST report counts whose linked record no longer
// currently qualifies for the Dashboard total (soft-deleted booking,
// cancelled/refunded order, etc.) — which is an intentional design
// difference per the GST report's own code comments, but still needs to be
// visible/explainable. This walks the GST side instead.
async function diagnose() {
  await connectDB();

  const transactions = await Transaction.find({ status: "success" }).lean();

  console.log(`Checking ${transactions.length} success transaction(s).\n`);

  let extraTotal = 0;
  const extras = [];

  for (const txn of transactions) {
    const gstAmount =
      txn.transactionType === "order"
        ? round2(txn.amount || 0)
        : round2(txn.baseAmount > 0 ? txn.baseAmount : txn.amount || 0);

    let qualifies = false;
    let reason = "";

    if (txn.transactionType === "consultation") {
      const b = txn.booking ? await Booking.findById(txn.booking).lean() : null;
      if (!b) reason = "booking not found (orphaned)";
      else if (b.isDeleted) reason = "booking.isDeleted = true";
      else if (b.status !== "booked") reason = `booking.status = "${b.status}"`;
      else if (b.paymentStatus !== "paid") reason = `booking.paymentStatus = "${b.paymentStatus}"`;
      else qualifies = true;
    } else if (txn.transactionType === "order") {
      const o = txn.order ? await Order.findById(txn.order).lean() : null;
      if (!o) reason = "order not found (orphaned)";
      else if (o.payment?.status !== "paid") reason = `order.payment.status = "${o.payment?.status}"`;
      else qualifies = true;
    } else if (txn.transactionType === "report") {
      const r = txn.report ? await ReportOrder.findById(txn.report).lean() : null;
      if (!r) reason = "reportOrder not found (orphaned)";
      else if (r.paymentStatus !== "paid") reason = `reportOrder.paymentStatus = "${r.paymentStatus}"`;
      else qualifies = true;
    } else {
      reason = `unknown transactionType "${txn.transactionType}"`;
    }

    if (!qualifies) {
      extraTotal += gstAmount;
      extras.push({
        id: txn._id.toString(),
        type: txn.transactionType,
        amount: gstAmount,
        reason,
        createdAt: txn.createdAt,
      });
    }
  }

  console.log(`Total GST-counted amount NOT reflected in Dashboard: ${round2(extraTotal)}\n`);
  extras.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  for (const e of extras) {
    console.log(
      `[${e.type}] ${e.id}  amount=${e.amount}  reason=${e.reason}  (${new Date(e.createdAt).toISOString().slice(0, 10)})`,
    );
  }

  await mongoose.disconnect();
}

diagnose().catch((err) => {
  console.error("Diagnosis failed:", err);
  process.exit(1);
});
