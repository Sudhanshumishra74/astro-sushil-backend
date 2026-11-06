// One-off migration: assigns real sequential invoice/credit-note numbers
// (INV-001, INV-002, ... / CN-001, CN-002, ...) to every existing order,
// booking, report order, and refunded return — in actual chronological
// order — instead of leaving them to be assigned lazily (in whatever order
// each is next downloaded) by utils/invoiceSequence.js. Run this once,
// before real usage of the new sequence-numbered invoices/credit notes.
//
// Safe to re-run: resets both counters and reassigns everything from
// scratch each time, rather than only filling in unset numbers — so running
// it twice produces the same result, not a second incrementing pass.
import dotenv from "dotenv";
dotenv.config();
import dns from "dns";
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
}
import mongoose from "mongoose";
import { Order } from "../modules/Order/order.model.js";
import { Booking } from "../modules/booking/booking.model.js";
import ReportOrder from "../modules/Reports/reportOrder.model.js";
import { Return } from "../modules/Return/return.model.js";
import { Counter } from "../modules/Counter/counter.model.js";
import { formatInvoiceNumber, formatCreditNoteNumber } from "../utils/invoiceSequence.js";
import { DB_NAME } from "../utils/constants.js";

async function run() {
  await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);

  await Counter.deleteMany({ _id: { $in: ["invoice", "creditNote"] } });
  await Order.updateMany({}, { $set: { invoiceNumber: null } });
  await Booking.updateMany({}, { $set: { invoiceNumber: null } });
  await ReportOrder.updateMany({}, { $set: { invoiceNumber: null } });
  await Return.updateMany({}, { $set: { creditNoteNumber: null } });

  // ── Invoices: Orders + Bookings + ReportOrders share one sequence,
  // merged into actual creation-time order — excludes anything that never
  // completed payment (payment_pending/payment_failed/pending), since those
  // never really had an invoice moment. Cancelled orders/bookings are kept:
  // they were paid before being cancelled, so the invoice they were issued
  // still belongs in the sequence.
  const [orders, bookings, reportOrders] = await Promise.all([
    Order.find({ orderStatus: { $nin: ["payment_pending", "payment_failed"] } })
      .select("_id createdAt")
      .lean(),
    Booking.find({ paymentStatus: "paid" }).select("_id createdAt").lean(),
    ReportOrder.find({ paymentStatus: "paid" }).select("_id createdAt").lean(),
  ]);

  const invoiceRecords = [
    ...orders.map((o) => ({ Model: Order, id: o._id, createdAt: o.createdAt })),
    ...bookings.map((b) => ({ Model: Booking, id: b._id, createdAt: b.createdAt })),
    ...reportOrders.map((r) => ({ Model: ReportOrder, id: r._id, createdAt: r.createdAt })),
  ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  let seq = 0;
  for (const rec of invoiceRecords) {
    seq += 1;
    await rec.Model.updateOne(
      { _id: rec.id },
      { $set: { invoiceNumber: formatInvoiceNumber(seq) } },
    );
  }
  await Counter.findOneAndUpdate(
    { _id: "invoice" },
    { $set: { seq } },
    { upsert: true },
  );

  // ── Credit notes: Returns, ordered by when the refund was actually
  // issued (matches renderCreditNotePdf's own "refunded" gate) rather than
  // when the return was first requested.
  const returns = await Return.find({ status: "refunded" })
    .select("_id refundedAt createdAt")
    .lean();
  returns.sort(
    (a, b) => new Date(a.refundedAt || a.createdAt) - new Date(b.refundedAt || b.createdAt),
  );

  let cnSeq = 0;
  for (const ret of returns) {
    cnSeq += 1;
    await Return.updateOne(
      { _id: ret._id },
      { $set: { creditNoteNumber: formatCreditNoteNumber(cnSeq) } },
    );
  }
  await Counter.findOneAndUpdate(
    { _id: "creditNote" },
    { $set: { seq: cnSeq } },
    { upsert: true },
  );

  console.log(
    `Backfilled ${seq} invoice number(s) (${orders.length} orders, ${bookings.length} bookings, ${reportOrders.length} report orders) and ${cnSeq} credit note number(s).`,
  );

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
