import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import { Shipment } from "../modules/Shipment/shipment.model.js";
import { Return } from "../modules/Return/return.model.js";
import { shipmentToSummary, returnToSummary } from "../modules/Fulfillment/orderSync.js";

dotenv.config();

// One-time migration: moves the legacy embedded Order.shipments[]/returns[]
// (full documents) into their own top-level Shipment/Return collections,
// preserving each entry's original _id (so any in-flight reference, e.g. a
// queued notification job, still resolves), then rewrites Order.shipments/
// returns as the new denormalized summary shape.
//
// Reads/writes orders via the RAW driver, not the Mongoose Order model —
// deliberately decoupled from whichever Order schema version happens to be
// loaded in this process, since the new schema would otherwise silently
// strip the legacy full-shape fields this script needs to read.
//
// Safe to re-run: an order whose shipments/returns are already in the new
// summary shape (identified by the presence of `shipmentId`/`returnId`) is
// skipped entirely.

function omit(obj, keys) {
  const result = { ...obj };
  for (const key of keys) delete result[key];
  return result;
}

async function migrate() {
  await connectDB();
  const ordersCol = mongoose.connection.db.collection("orders");

  const cursor = ordersCol.find({
    $or: [{ "shipments.0": { $exists: true } }, { "returns.0": { $exists: true } }],
  });

  let ordersProcessed = 0;
  let ordersSkipped = 0;
  let shipmentsCreated = 0;
  let returnsCreated = 0;

  while (await cursor.hasNext()) {
    const order = await cursor.next();

    const legacyShipments = (order.shipments || []).filter((s) => !s.shipmentId);
    const legacyReturns = (order.returns || []).filter((r) => !r.returnId);

    if (!legacyShipments.length && !legacyReturns.length) {
      ordersSkipped += 1;
      continue;
    }

    const shipmentIdMap = new Map(); // old embedded shipment _id -> new Shipment _id (same value, kept explicit for clarity)
    const shipmentSummaries = [];

    for (const s of legacyShipments) {
      const shipmentDoc = await Shipment.create({
        _id: s._id,
        order: order._id,
        ...omit(s, ["_id"]),
      });
      shipmentIdMap.set(String(s._id), shipmentDoc._id);
      shipmentSummaries.push(shipmentToSummary(shipmentDoc));
      shipmentsCreated += 1;
    }

    const returnSummaries = [];

    for (const r of legacyReturns) {
      const returnDoc = await Return.create({
        _id: r._id,
        order: order._id,
        ...omit(r, ["_id", "originShipmentId"]),
        originShipmentId: r.originShipmentId ? shipmentIdMap.get(String(r.originShipmentId)) || r.originShipmentId : null,
      });
      returnSummaries.push(returnToSummary(returnDoc));
      returnsCreated += 1;
    }

    // Any already-migrated entries (shouldn't normally coexist with legacy
    // ones, but kept for safety) pass through untouched.
    const finalShipments = [...(order.shipments || []).filter((s) => s.shipmentId), ...shipmentSummaries];
    const finalReturns = [...(order.returns || []).filter((r) => r.returnId), ...returnSummaries];

    await ordersCol.updateOne(
      { _id: order._id },
      { $set: { shipments: finalShipments, returns: finalReturns } },
    );

    ordersProcessed += 1;
  }

  console.log(
    `Processed ${ordersProcessed} orders (${ordersSkipped} already migrated) — created ${shipmentsCreated} shipments, ${returnsCreated} returns.`,
  );

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
