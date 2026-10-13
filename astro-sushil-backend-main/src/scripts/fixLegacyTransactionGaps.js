import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import ReportOrder from "../modules/Reports/reportOrder.model.js";
import { Transaction } from "../modules/Transaction/Transaction.model.js";

dotenv.config();

// Two one-off historical data gaps found while reconciling the GST report
// against the Dashboard's revenue total:
//
// 1. Report-purchase Transactions created before commit c19992a
//    ("Enhance transaction and report handling with additional currency and
//    GST fields", 2026-07-29) never had `baseAmount` populated. The GST
//    report falls back to the raw (non-INR) `amount` when `baseAmount` is 0,
//    understating foreign-currency report purchases. `buyReport` has
//    written this correctly since that commit — this only backfills
//    records from before it.
//
// 2. A small number of Transactions have `status: "paid"`, which isn't a
//    valid value in the schema's enum ("pending"/"success"/"failed"). The
//    current webhook/verify-payment code only ever writes "success" — this
//    normalizes any leftover "paid" values so the GST report's
//    `status: "success"` filter picks them up.
async function fixLegacyTransactionGaps() {
  await connectDB();

  const reportTxns = await Transaction.find({
    transactionType: "report",
    $or: [{ baseAmount: 0 }, { baseAmount: { $exists: false } }],
  });

  let baseAmountFixed = 0;

  for (const txn of reportTxns) {
    const reportOrder = await ReportOrder.findById(txn.report).lean();
    if (reportOrder?.baseAmount > 0) {
      txn.baseAmount = reportOrder.baseAmount;
      await txn.save();
      baseAmountFixed += 1;
    }
  }

  const statusResult = await Transaction.updateMany(
    { status: "paid" },
    { $set: { status: "success" } },
  );

  console.log(`Report transactions backfilled with baseAmount: ${baseAmountFixed}`);
  console.log(`Transactions normalized from status "paid" to "success": ${statusResult.modifiedCount}`);

  await mongoose.disconnect();
}

fixLegacyTransactionGaps().catch((err) => {
  console.error("Fix failed:", err);
  process.exit(1);
});
