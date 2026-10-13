import mongoose from "mongoose";

const testimonialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    designation: String,

    message: {
      type: String,
      required: true,
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },

    image: String,
    imageKey: String,

   
    serviceName: String,  
    tagline: String,      

    type: {
      type: String,
      enum: ["text", "video"],
      default: "text",
    },

    videoUrl: String,

    page: {
      type: String,
      default: "home",
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
  { timestamps: true }
);

export const Testimonial = mongoose.model("Testimonial", testimonialSchema);