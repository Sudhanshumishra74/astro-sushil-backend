import mongoose from "mongoose";

// One document per named sequence (e.g. "invoice", "creditNote") — the
// _id IS the sequence name, so `$inc` via findOneAndUpdate is a single
// atomic round-trip with no separate lookup, and concurrent requests for
// the same sequence can never hand out the same number twice.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model("Counter", counterSchema);
