import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    module: {
      type: String,
      required: true,
      trim: true,
    },

    moduleLabel: {
      type: String,
      required: true,
      trim: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
    },

    label: {
      type: String,
      required: true,
      trim: true,
    },

    group: {
      type: String,
      required: true,
      trim: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

permissionSchema.index({ module: 1, action: 1 }, { unique: true });
permissionSchema.index({ group: 1, sortOrder: 1 });

export const Permission =
  mongoose.models.Permission || mongoose.model("Permission", permissionSchema);
