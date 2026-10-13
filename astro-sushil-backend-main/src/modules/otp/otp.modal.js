import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true },
    channel: { type: String, enum: ["EMAIL", "PHONE"], required: true },
    otp: { type: String, required: true },
    type: { type: String, enum: ["VERIFY", "RESET", "AUTH"], default: "VERIFY" },

    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Otp = mongoose.model("Otp", otpSchema);
