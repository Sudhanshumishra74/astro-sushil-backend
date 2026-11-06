import mongoose from "mongoose";

// See bookingSchema.adminNotes below for why this exists as its own
// sub-schema (needs { _id: false }, which an inline array-of-objects
// definition can't express).
const adminNoteSchema = new mongoose.Schema(
  {
    note: { type: String, trim: true, required: true },
    action: {
      type: String,
      enum: ["reschedule", "plan_change"],
      required: true,
    },
    addedBy: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Consultation",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },

    mode: {
      type: String,
      enum: ["audio", "video", "in_person"],
      required: true,
    },

    // consultation prices
    price: {
      inr: Number,
      usd: Number,
    },

    // selected currency
    amount: {
      type: Number,
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

    exchangeRate: {
      type: Number,
      default: 1,
    },

    gst: {
      rate: { type: Number, default: 0 },
      type: { type: String, enum: ["inclusive", "exclusive"], default: "inclusive" },
      taxableAmount: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
    },

    duration: Number,
    priceLabel: String,

    discountType: {
      type: String,
      enum: ["FLAT", "PERCENTAGE"],
      default: null,
    },

    discountValue: {
      type: Number,
      default: 0,
    },

    discountAmount: {
      type: Number,
      default: 0,
    },

    date: {
      type: String,
      required: true,
    },

    slot: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["booked", "cancelled", "pending"],
      default: "booked",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    bookingSource: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    note: {
      type: String,
      trim: true,
    },

    adminNotes: { type: [adminNoteSchema], default: [] },

    // Assigned once, the first time this booking's invoice is actually
    // viewed/downloaded (see utils/invoiceSequence.js).
    invoiceNumber: { type: String, default: null },

    reminderSent: {
      type: Boolean,
      default: false,
    },

    reminderSentAt: {
      type: Date,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
    },

    recommendedProducts: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        note: { type: String, default: "" },
        recommendedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

bookingSchema.index(
  { date: 1, slot: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "booked", isDeleted: false },
  },
);

export const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
