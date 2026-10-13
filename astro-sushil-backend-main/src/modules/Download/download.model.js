

import mongoose from "mongoose";

const downloadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    productName: String,

    file: {
      type: String,
      required: true,
    },

    thumbnail: String,

    totalDownloads: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

downloadSchema.index(
  {
    user: 1,
    order: 1,
    product: 1,
  },
  { unique: true },
);

export const Download = mongoose.model("Download", downloadSchema);
