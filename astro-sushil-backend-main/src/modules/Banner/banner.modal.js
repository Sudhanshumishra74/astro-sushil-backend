import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    title: String,
    subtitle: String,
    description: String,
    image: String,
    type: {
      type: String,
      enum: ["Slider", "Page"],
      required: true,
    },

    buttons: [
      {
        text: String,
        link: String,
      },
    ],

    page: {
      type: String,
      enum: ["Homepage", "About", "Contact", "Services"],
      default: "Homepage",
    },

    order: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export const Banner = mongoose.model("Banner", bannerSchema);
