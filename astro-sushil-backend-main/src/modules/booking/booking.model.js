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

    // Internal notes an admin adds when rescheduling or changing this
    // booking's plan — staff reference only, NEVER shown to the customer
    // (unlike `note` above). Kept as a history rather than a single
    // overwritable field, so a later reschedule/plan change doesn't erase
    // the reasoning recorded for an earlier one. `addedBy` is a snapshot of
    // the admin's name at write time, not a ref — same reasoning as other
    // snapshotted display fields elsewhere in this codebase (e.g. order
    // item names), so the note still reads correctly even if that admin
    // account is later renamed or removed.
    adminNotes: { type: [adminNoteSchema], default: [] },

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
