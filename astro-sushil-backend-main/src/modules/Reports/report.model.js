import mongoose from "mongoose";
import { computeGst } from "../../common/taxEngine.js";

const reportFeatureSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    icon: {
      type: String,
      default: "",
    },
  },
  { _id: false },
);

const reportBenefitSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const reportFaqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const reportSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    reportType: {
      type: String,
      required: true,
      enum: ["basic_horoscope_pdf", "mini_horoscope_pdf", "pro_horoscope_pdf", "match_making_pdf"],
    },

    shortDescription: {
      type: String,
      default: "",
    },

    description: {
      type: String,
      required: true,
    },

    coverImage: {
      type: String,
      required: true,
    },

    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    salePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    benefits: [reportBenefitSchema],

    features: [reportFeatureSchema],

    faqs: [reportFaqSchema],

    isPremium: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    gst: {
      enabled: { type: Boolean, default: true },
      rate: { type: Number, default: 0, min: 0, max: 100 },
      type: {
        type: String,
        enum: ["inclusive", "exclusive"],
        default: "exclusive",
      },
    },

    priceWithGst: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

reportSchema.pre("save", function () {
  this.priceWithGst = computeGst(this.salePrice, this.gst).total;
});

export default mongoose.model("Report", reportSchema);
