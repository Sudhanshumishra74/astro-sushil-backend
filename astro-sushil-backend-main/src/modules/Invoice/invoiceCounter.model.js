import mongoose from "mongoose";

const invoiceCounterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: "invoice",
    },

    nextSequence: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "nextSequence must be an integer",
      },
    },
  },
  { collection: "counters", timestamps: true },
);

export const InvoiceCounter =
  mongoose.models.InvoiceCounter ||
  mongoose.model("InvoiceCounter", invoiceCounterSchema);
