import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    sequence: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
    },

    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },

    sourceType: {
      type: String,
      required: true,
      enum: ["order", "booking", "report"],
      immutable: true,
    },

    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },

    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
      immutable: true,
    },
  },
  { timestamps: true },
);

invoiceSchema.index(
  { invoiceNumber: 1 },
  { name: "invoiceNumber_unique", unique: true },
);
invoiceSchema.index(
  { sourceType: 1, sourceId: 1 },
  { name: "sourceType_sourceId_unique", unique: true },
);

export const Invoice =
  mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);
