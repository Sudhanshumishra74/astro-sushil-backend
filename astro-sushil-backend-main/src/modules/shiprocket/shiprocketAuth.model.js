import mongoose from "mongoose";

const shiprocketAuthSchema = new mongoose.Schema(
  {
    _key: { type: String, required: true, unique: true, default: "singleton" },
    token: { type: String, default: null },
    tokenExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

shiprocketAuthSchema.statics.get = async function () {
  let doc = await this.findOne({ _key: "singleton" });
  if (!doc) {
    doc = await this.create({ _key: "singleton" });
  }
  return doc;
};

export const ShiprocketAuth = mongoose.model("ShiprocketAuth", shiprocketAuthSchema);
