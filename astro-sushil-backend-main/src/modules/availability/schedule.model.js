import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    blockedSlots: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true },
);


export const Schedule = mongoose.model("Schedule", scheduleSchema);