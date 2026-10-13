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
  },
  { _id: false },
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
    tax: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model("Cart", cartSchema);
