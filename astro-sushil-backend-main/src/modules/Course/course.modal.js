import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, unique: true },

    shortDescription: String,
    category: String,
    tags: [String],

    instructorName: String,

    language: String,
    level: {
      type: String,
      enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
    },

    price: { type: Number, required: true },
    originalPrice: Number,
    discountPercentage: Number,
    currency: { type: String, default: "INR" },
    isFree: { type: Boolean, default: false },

    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },

    totalLessons: Number,
    totalDurationMinutes: Number,

    thumbnail: String,
    thumbnailKey: String,
    previewVideo: String,

    platformName: String,
    redirectUrl: { type: String, required: true },
    clickCount: { type: Number, default: 0 },

    isFeatured: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },

    metaTitle: String,
    metaDescription: String,
  },
  { timestamps: true }
);

export const Course = mongoose.model("Course", courseSchema);