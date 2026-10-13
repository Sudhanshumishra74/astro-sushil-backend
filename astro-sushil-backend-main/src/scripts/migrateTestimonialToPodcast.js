import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import { Media } from "../modules/Media/Media.model.js";

dotenv.config();

async function migrateTestimonialToPodcast() {
  await connectDB();

  const result = await Media.updateMany(
    { section: "testimonial" },
    { $set: { section: "podcast" } },
  );

  console.log(
    `Matched: ${result.matchedCount}, modified: ${result.modifiedCount}`,
  );

  await mongoose.disconnect();
}

migrateTestimonialToPodcast().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
