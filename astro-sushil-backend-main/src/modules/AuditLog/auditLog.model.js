import mongoose from "mongoose";

const changeSchema = new mongoose.Schema(
  {
    field: String,
    from: mongoose.Schema.Types.Mixed,
    to: mongoose.Schema.Types.Mixed,
  },
  { _id: false },
);

const auditLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },

    adminName: { type: String, required: true },
    adminEmail: { type: String, default: null },

    action: { type: String, required: true },

    targetType: { type: String, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },

    targetLabel: String,

    changes: { type: [changeSchema], default: [] },
  },
  { timestamps: true },
);

auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ admin: 1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
