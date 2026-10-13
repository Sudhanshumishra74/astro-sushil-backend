import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReportOrder",
      default: null,
    },
    transactionType: {
      type: String,
      enum: ["order", "consultation", "report"],
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
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

    subTotal: {
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

    taxRate: {
      type: Number,
      default: 0,
    },

    taxInclusive: {
      type: Boolean,
      default: false,
    },

    discount: {
      type: Number,
      default: 0,
    },

    exchangeRate: {
      type: Number,
      default: 1,
    },

    method: {
      type: String,
      enum: ["cod", "razorpay", "manual"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "success", "failed"],
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

    rawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const Transaction =
  mongoose.models.Transaction ||
  mongoose.model("Transaction", transactionSchema);
