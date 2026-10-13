import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    section: {
      type: String,
      enum: ["podcast", "celebrity", "wishes"],
      required: true,
    },

    type: {
      type: String,
      enum: ["video", "image"],
      default: "image",
    },

    mediaUrl: {
      type: String,
    },

    thumbnail: {
      type: String,
      default: "",
    },
    mediaKey: {
      type: String,
      default: "",
    },

    thumbnailKey: {
      type: String,
      default: "",
    },

    tag: {
      type: String,
      default: "",
    },

    personName: {
      type: String,
      default: "",
    },

    background: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

export const Media = mongoose.model("Media", mediaSchema);
