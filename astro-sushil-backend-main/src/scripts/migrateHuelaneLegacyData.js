import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";

dotenv.config();

// One-time cleanup after removing the Huelane dropship integration: the
// Product/Cart/Order/Shipment/Return schemas now only allow
// source: "internal" / fulfillmentType: "self", but documents written
// before the removal can still hold the old "huelane"/"dropship" values,
// which fails Mongoose validation the next time any of those documents is
// re-saved (e.g. a stock decrement on checkout). This rewrites every
// legacy value in place via the raw driver, bypassing Mongoose validation
// entirely so the fix applies regardless of current schema shape.
//
// Also drops the now-unused Setting.huelane sub-document, purely for
// hygiene (an unknown field is silently stripped by Mongoose, never a
// validation error, so this part is optional cleanup, not a fix).
//
// Safe to re-run: every update only touches documents that still carry the
// legacy value, so a second run matches (and changes) nothing.

async function migrate() {
  await connectDB();
  const db = mongoose.connection.db;

  const productsResult = await db
    .collection("products")
    .updateMany({ source: "huelane" }, { $set: { source: "internal" } });

  const cartsResult = await db
    .collection("carts")
    .updateMany(
      { "items.source": "huelane" },
      { $set: { "items.$[item].source": "internal" } },
      { arrayFilters: [{ "item.source": "huelane" }] },
    );

  const orderItemsResult = await db
    .collection("orders")
    .updateMany(
      { "items.source": "huelane" },
      { $set: { "items.$[item].source": "internal" } },
      { arrayFilters: [{ "item.source": "huelane" }] },
    );

  const orderShipmentsResult = await db
    .collection("orders")
    .updateMany(
      { "shipments.fulfillmentType": "dropship" },
      { $set: { "shipments.$[s].fulfillmentType": "self" } },
      { arrayFilters: [{ "s.fulfillmentType": "dropship" }] },
    );

  const orderReturnsResult = await db
    .collection("orders")
    .updateMany(
      { "returns.fulfillmentType": "dropship" },
      { $set: { "returns.$[r].fulfillmentType": "self" } },
      { arrayFilters: [{ "r.fulfillmentType": "dropship" }] },
    );

  const shipmentsResult = await db
    .collection("shipments")
    .updateMany({ fulfillmentType: "dropship" }, { $set: { fulfillmentType: "self" } });

  const returnsResult = await db
    .collection("returns")
    .updateMany({ fulfillmentType: "dropship" }, { $set: { fulfillmentType: "self" } });

  const settingsResult = await db
    .collection("settings")
    .updateMany({ huelane: { $exists: true } }, { $unset: { huelane: "" } });

  console.log("Huelane legacy data migration complete:");
  console.log(`  products: ${productsResult.modifiedCount} source huelane -> internal`);
  console.log(`  carts: ${cartsResult.modifiedCount} docs with item source huelane -> internal`);
  console.log(`  orders (items): ${orderItemsResult.modifiedCount} docs with item source huelane -> internal`);
  console.log(`  orders (shipments): ${orderShipmentsResult.modifiedCount} docs with shipment fulfillmentType dropship -> self`);
  console.log(`  orders (returns): ${orderReturnsResult.modifiedCount} docs with return fulfillmentType dropship -> self`);
  console.log(`  shipments: ${shipmentsResult.modifiedCount} fulfillmentType dropship -> self`);
  console.log(`  returns: ${returnsResult.modifiedCount} fulfillmentType dropship -> self`);
  console.log(`  settings: ${settingsResult.modifiedCount} huelane sub-document removed`);

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
