import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    // Exact, case-sensitive identifier matching authorize()/hasPermission()
    // calls throughout the codebase (e.g. "reportOrders.view") — NOT
    // lowercased. A `lowercase: true` setter here used to silently mangle
    // every camelCase module name (reportOrders, gstReport, pdfReports,
    // activityLog) to all-lowercase on write, while flattenCatalog() still
    // produced the camelCase name — permanently desyncing the stored
    // Permission doc from what every permission check actually looks for,
    // even though the Roles UI still showed the checkbox as granted (module/
    // moduleLabel/label kept updating correctly on every reseed — only
    // `name` itself could never self-correct once mangled).
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
