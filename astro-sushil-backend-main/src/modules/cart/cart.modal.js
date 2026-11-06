import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Cascading second level — set only when the selected variant has
    // sub-variants (see product.modal.js's variantSchema).
    subVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Snapshot of the selected variant/sub-variant's own name+value (e.g.
    // "Size"/"XL"). variantId/subVariantId alone are enough to resolve
    // price/stock server-side, but the cart/checkout UI has no other way to
    // show *which* option was picked without re-fetching the product, so
    // it's snapshotted here at add-to-cart time instead.
    variantName: { type: String, default: null },
    variantValue: { type: String, default: null },
    subVariantName: { type: String, default: null },
    subVariantValue: { type: String, default: null },

    // Set only for a soldByRatti (gemstone) product — see
    // product.modal.js/utils/ratti.js. price/mrp below are already the
    // per-line total for this ratti (product.price/mrp * selectedRatti),
    // not a per-1-ratti rate.
    selectedRatti: { type: Number, default: null },

    // Single certificate chosen from product.certificates (dropdown,
    // single-select) — see product.modal.js's certificateSchema.
    // certificatePrice is the extra charge only (0 when includedInPrice),
    // resolved server-side at addToCart time and never trusted from the
    // client; kept separate from `price`/`mrp` (not folded in) so it can be
    // shown as its own line/tag without disturbing the discount display.
    certificateId: { type: mongoose.Schema.Types.ObjectId, default: null },
    certificateName: { type: String, default: null },
    certificatePrice: { type: Number, default: 0 },
    certificateIncludedInPrice: { type: Boolean, default: false },

    name: String,
    thumbnail: String,

    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },

    price: Number,
    mrp: Number,

    total: Number,

    taxRate: { type: Number, default: 0 },
    taxType: { type: String, enum: ["inclusive", "exclusive"], default: "exclusive" },
    taxAmount: { type: Number, default: 0 },

    source: { type: String, enum: ["internal"], default: "internal" },
  },
  // Each line needs a stable identity of its own — matching by
  // product+variant breaks down the moment two lines share the same product
  // with an ambiguous key, which is exactly what let a quantity +/- on one
  // cart row silently mutate a different row with the same composite key.
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    items: [cartItemSchema],

    subTotal: { type: Number, default: 0 },

    discount: { type: Number, default: 0 },
    couponCode: String,

    shipping: { type: Number, default: 0 },
    // Breakdown of `shipping` by source — see priceengine.js's
    // calculateCart. Always sums back to `shipping`.
    selfShippingAmount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

    // Set once the abandoned-cart reminder cron (notification.worker.js)
    // sends the one-shot recovery email for this cart's current contents —
    // prevents re-sending on every subsequent cron tick while the cart
    // stays stale. Reset back to null below whenever `items` changes, so a
    // cart that becomes active again and later goes stale a second time is
    // still eligible for exactly one more reminder.
    abandonedCartReminderSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// No `next` param — a zero-arg pre hook is treated as synchronous by
// Mongoose (no callback to invoke, nothing to await), which is all this
// needs since it's just an in-memory field mutation.
cartSchema.pre("save", function () {
  if (this.isModified("items") && this.abandonedCartReminderSentAt) {
    this.abandonedCartReminderSentAt = null;
  }
});

export default mongoose.model("Cart", cartSchema);
