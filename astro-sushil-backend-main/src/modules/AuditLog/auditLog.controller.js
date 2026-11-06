import { AuditLog } from "./auditLog.model.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const getAuditLogs = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const { search, targetType, action, admin, fromDate, toDate } = req.query;

  const query = {};

  if (targetType) query.targetType = targetType;
  if (action) query.action = action;

  // Exact-match staff filter — separate from the fuzzy adminName `search`
  // below, since two staff can share a name prefix and a dropdown filter
  // needs to pick exactly one of them, not a substring match.
  if (admin) query.admin = admin;

  // adminName/adminEmail/targetLabel are all snapshotted onto the log entry
  // at write time (see auditLog.service.js) specifically so a search here
  // doesn't need to populate/join against the Admin or target collections.
  if (search) {
    query.$or = [
      { adminName: { $regex: search, $options: "i" } },
      { adminEmail: { $regex: search, $options: "i" } },
      { targetLabel: { $regex: search, $options: "i" } },
    ];
  }

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AuditLog.countDocuments(query),
  ]);

  return res.json(
    new ApiResponse(200, logs, "Activity log fetched", { total, page, limit }),
  );
});
