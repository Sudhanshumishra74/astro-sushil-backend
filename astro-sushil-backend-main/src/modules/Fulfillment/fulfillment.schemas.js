import mongoose from "mongoose";


export const shipmentItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: String,
    quantity: Number,
    sku: String,

    // Which exact order line this came from (order.model.js's orderItemSchema
    // now gives each line its own _id) — lets findOrderItem (fulfillment.
    // service.js) resolve the precise line instead of matching by product id
    // alone, which always resolved to whichever line came first whenever an
    // order had two lines for the same product with different
    // variant/design/metal selections. Null for a Return/Shipment built from
    // an older order item that predates per-line ids.
    orderItemId: { type: mongoose.Schema.Types.ObjectId, default: null },

    // Snapshot of the ordered variant/sub-variant's own id + name+value — the
    // warehouse/admin needs to know exactly which option to pack, not just
    // that the order line references some variantId.
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    subVariantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    variantName: { type: String, default: null },
    variantValue: { type: String, default: null },
    subVariantName: { type: String, default: null },
    subVariantValue: { type: String, default: null },

    // Set only for a soldByRatti (gemstone) order line — see
    // product.modal.js/utils/ratti.js. The warehouse/admin needs to know
    // exactly how many ratti to pack, not just the piece quantity above.
    selectedRatti: { type: Number, default: null },
  },
  { _id: false },
);

export const shipmentStatusHistorySchema = new mongoose.Schema(
  {
    code: Number,
    status: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);
