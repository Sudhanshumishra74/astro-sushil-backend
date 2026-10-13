import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],

    // Wildcard: authorize() grants every permission (including ones created
    // after this role) whenever this flag is set, without reading the
    // permissions array below. Detected by this boolean, not by name/slug,
    // so renaming the role can never silently break the wildcard.
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },

    // Seed-owned role (Super Admin / Admin): cannot be renamed or deleted,
    // though its permission set (other than Super Admin's) can still be
    // edited by a Super Admin.
    isSystem: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true },
);

export const Role = mongoose.models.Role || mongoose.model("Role", roleSchema);
