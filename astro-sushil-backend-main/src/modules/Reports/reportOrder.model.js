import mongoose from "mongoose";

const personDetailsSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    whatsappNumber: {
      type: String,
      trim: true,
      default: "",
    },

    dateOfBirth: {
      type: Date,
      required: true,
    },

    timeOfBirth: {
      type: String,
      required: true,
    },

    birthPlace: {
      type: String,
      required: true,
      trim: true,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },

    pinCode: {
      type: String,
      trim: true,
      default: "",
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },

    reportLanguage: {
      type: String,
      enum: ["en", "hi"],
      // required: true,
    },
  },
  { _id: false },
);

const reportOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
      required: true,
    },

    reportType: {
      type: String,
      enum: [
        "basic_horoscope_pdf",
        "mini_horoscope_pdf",
        "pro_horoscope_pdf",
        "match_making_pdf",
      ],
      required: true,
    },

    // For normal horoscope reports
    customerDetails: {
      type: personDetailsSchema,
      required: function () {
        return this.reportType !== "match_making_pdf";
      },
    },

    // Only for matchmaking report
    matchMakingDetails: {
      bride: {
        type: personDetailsSchema,
        required: function () {
          return this.reportType === "match_making_pdf";
        },
      },

      groom: {
        type: personDetailsSchema,
        required: function () {
          return this.reportType === "match_making_pdf";
        },
      },

      reportLanguage: {
        type: String,
        required: function () {
          return this.reportType === "match_making_pdf";
        },
        trim: true,
      },
    },

    baseAmount: {
      type: Number,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    gst: {
      rate: { type: Number, default: 0 },
      type: { type: String, enum: ["inclusive", "exclusive"], default: "exclusive" },
      taxableAmount: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
    },

    currency: {
      type: String,
      default: "INR",
    },

    currencyRate: {
      type: Number,
      default: 1,
    },

    razorpayOrderId: {
      type: String,
      required: true,
    },

    razorpayPaymentId: {
      type: String,
      default: "",
    },

    razorpaySignature: {
      type: String,
      default: "",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    reportStatus: {
      type: String,
      enum: ["pending", "processing", "completed"],
      default: "pending",
    },

    reportUrl: {
      type: String,
      default: null,
    },

    isReportSent: {
      type: Boolean,
      default: false,
    },

    isEmailSent: {
      type: Boolean,
      default: false,
    },

    isWhatsappSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("ReportOrder", reportOrderSchema);
