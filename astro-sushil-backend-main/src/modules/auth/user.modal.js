import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String },

    username: { type: String ,unique: true},

    email: {
      type: String,
      unique: true,
      sparse: true,   // allows multiple documents without email
      lowercase: true,
    },

    phoneNumber: { type: String, required: true },

    skill: { type: String },
    dob: String,
    gender: String,
    birthPlace: String,
    birthTime: String,
    bio: { type: String },

    displayName: { type: String },

    profilePhoto: { type: String },
    coverPhoto: { type: String },

    socialLinks: {
      linkedin: String,
      twitter: String,
      github: String,
      website: String,
    },

    refreshToken: { type: String, select: false },

    isVerified: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["ACTIVE", "BLOCKED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true }
);

userSchema.methods.generateAccessToken = function () {
  return jwt.sign({ _id: this._id }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1d",
  });
};

export const User = mongoose.model("User", userSchema);