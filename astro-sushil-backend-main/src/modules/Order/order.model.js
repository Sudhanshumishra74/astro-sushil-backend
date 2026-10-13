import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    name: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    mrp: {
      type: Number,
      default: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    image: {
      type: String,
      default: null,
    },

    taxRate: {
      type: Number,
      default: 0,
    },

    taxType: {
      type: String,
      enum: ["inclusive", "exclusive"],
      default: "exclusive",
    },

    taxAmount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

const paymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ["cod", "razorpay"],
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },

    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    transactionId: {
      type: String,
      default: null,
    },

    razorpayOrderId: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: String,
    phone: String,
    pincode: String,
    state: String,
    city: String,
    addressLine1: String,
    addressLine2: String,
    landmark: String,
  },
  { _id: false },
);

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      default: null,
    },

    discountAmount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,
    },

    orderType: {
      type: String,
      enum: ["physical", "digital"],
      required: true,
    },

    addressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      default: null,
    },

    shippingAddress: {
      type: shippingAddressSchema,
      default: null,
    },

    subTotal: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    shipping: {
      type: Number,
      default: 0,
    },

    tax: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
    },

    baseCurrency: {
      type: String,
      default: "INR",
      uppercase: true,
    },

    baseAmount: {
      type: Number,
      default: 0,
    },

    exchangeRate: {
      type: Number,
      default: 1,
    },

    coupon: {
      type: couponSchema,
      default: null,
    },

    orderStatus: {
      type: String,
      enum: [
        "payment_pending",
        "placed",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "payment_failed",
      ],
      default: "payment_pending",
    },

    payment: {
      type: paymentSchema,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Order =
  mongoose.models.Order || mongoose.model("Order", orderSchema);
