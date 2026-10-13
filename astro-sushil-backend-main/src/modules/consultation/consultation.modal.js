import mongoose from "mongoose";
import { computeGst } from "../../common/taxEngine.js";

const consultationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },

    type: {
      type: String,
      enum: ["normal", "special"],
      default: "normal",
    },

    description: { type: String },

    responseDays: { type: Number, default: 0 },

    includes: [{ type: String }],

    duration: { type: Number, required: true },

    priceLabel: { type: String },

    modes: [
      {
        mode: {
          type: String,
          enum: ["audio", "video", "in_person"],
          required: true,
        },

        price: {
          inr: { type: Number, required: true },
        },

        gst: {
          enabled: { type: Boolean, default: true },
          rate: { type: Number, default: 0, min: 0, max: 100 },
          type: {
            type: String,
            enum: ["inclusive", "exclusive"],
            default: "inclusive",
          },
        },

        priceWithGst: { type: Number, default: 0 },
      },
    ],

    note: { type: String },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

consultationSchema.pre("save", function () {
  this.modes = (this.modes || []).map((m) => {
    const priceWithGst = computeGst(m.price?.inr || 0, m.gst).total;

    if (typeof m.toObject === "function") {
      return { ...m.toObject(), priceWithGst };
    }

    return { ...m, priceWithGst };
  });
});

export const Consultation = mongoose.model(
  "Consultation",
  consultationSchema
);