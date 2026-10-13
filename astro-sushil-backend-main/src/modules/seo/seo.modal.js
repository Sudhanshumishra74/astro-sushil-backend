import mongoose from "mongoose";

const seoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    metaTitle: {
      type: String,
      required: true,

      trim: true,
    },

    metaDescription: {
      type: String,
      required: true,
  
      trim: true,
    },

    image: {
      url: String,
      publicId: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Seo", seoSchema);