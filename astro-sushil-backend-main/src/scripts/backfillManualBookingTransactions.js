import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import { Booking } from "../modules/booking/booking.model.js";
import { Transaction } from "../modules/Transaction/Transaction.model.js";

dotenv.config();

// Two historical gaps this backfills, both stemming from the same root
// cause: Booking and Transaction were allowed to drift apart because some
// code paths only ever wrote to Booking.
//
// 1. Admin-created ("manual") bookings are marked paid immediately without
//    a Razorpay checkout, but createAdminBooking never created a matching
//    Transaction. The GST report reads only from Transaction, while the
//    Dashboard revenue total reads straight from Booking — so these
//    inflated the Dashboard total but never showed up in the GST report.
//
// 2. Admin "change plan" upgrades/downgrades update Booking.amount/gst in
//    place but (until now) never touched the linked Transaction, so the GST
//    report kept reporting the pre-change amount for any booking that was
//    later upgraded.
//
// Both are fixed by making the current Booking the source of truth: create
// a Transaction where one is missing, and resync amount/GST on any
// Transaction that has drifted from its Booking's current values.
async function backfillManualBookingTransactions() {
  await connectDB();

  const paidBookings = await Booking.find({ paymentStatus: "paid" });

  console.log(`Checking ${paidBookings.length} paid booking(s).`);

  let created = 0;
  let resynced = 0;

  for (const booking of paidBookings) {
    const transactionUpdate = {
      amount: booking.amount,
      baseAmount: booking.baseAmount || booking.amount,
      subTotal: booking.amount,
      tax: booking.gst?.amount || 0,
      taxRate: booking.gst?.rate || 0,
      taxInclusive: booking.gst?.type === "inclusive",
    };

    if (booking.transactionId) {
      const transaction = await Transaction.findById(booking.transactionId);

      if (!transaction) {
        // transactionId points at nothing (deleted/orphaned) — treat as missing.
        booking.transactionId = undefined;
      } else {
        const isStale =
          transaction.amount !== transactionUpdate.amount ||
          transaction.baseAmount !== transactionUpdate.baseAmount ||
          transaction.tax !== transactionUpdate.tax ||
          transaction.taxRate !== transactionUpdate.taxRate ||
          transaction.taxInclusive !== transactionUpdate.taxInclusive;

        if (isStale) {
          await Transaction.updateOne(
            { _id: transaction._id },
            { $set: transactionUpdate },
          );
          resynced += 1;
        }
        continue;
      }
    }

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
      createdAt: booking.createdAt,
      ...transactionUpdate,
    });

    booking.transactionId = transaction._id;
    await booking.save();

    created += 1;
  }

  console.log(`Done. Created ${created} transaction(s), resynced ${resynced}.`);
  await mongoose.disconnect();
}

backfillManualBookingTransactions().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
