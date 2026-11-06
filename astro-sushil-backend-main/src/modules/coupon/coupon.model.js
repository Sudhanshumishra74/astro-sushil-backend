import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    type: {
      type: String,
      enum: ["PERCENTAGE", "FLAT"],
      required: true,
    },

    discount: {
      type: Number,
      required: true,
    },

    maxDiscount: {
      type: Number,
      default: null,
    },

    minOrderAmount: {
      type: Number,
      default: 0,
    },

    usageLimit: {
      type: Number,
      default: null,
    },

    usedCount: {
      type: Number,
      default: 0,
    },

    validFrom: {
      type: Date,
      default: Date.now,
    },

    validTill: {
      type: Date,
      required: true,
    },

    couponType: {
      type: String,
      enum: ["GLOBAL", "INDIVIDUAL"],
      default: "GLOBAL",
    },

    assignedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    usedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
        // Which order this specific claim belongs to — without this,
        // releaseCouponUsage (priceengine.js) had no way to $pull just the
        // one entry for a cancelled order without also removing every
        // other order's claim by the same user on a multi-use-per-user
        // coupon (oneTimePerUser: false, usageLimit > 1).
        order: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
          default: null,
        },
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },

    oneTimePerUser: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Coupon = mongoose.model("Coupon", couponSchema);