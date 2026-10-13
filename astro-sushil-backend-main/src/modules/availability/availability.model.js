import mongoose from "mongoose";

const availabilitySchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    slotDuration: {
      type: Number,
      required: true,
    },
    gap: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);




export const Availability = mongoose.model("Availability", availabilitySchema);