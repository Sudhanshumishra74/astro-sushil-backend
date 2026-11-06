import { AuditLog } from "./auditLog.model.js";
import logger from "../../utils/logger.js";

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);

// Recurses into nested plain objects (e.g. Setting.shipping.chargeSelfFulfilled)
// so a change buried in one sub-field shows up as its own readable
// "shipping.chargeSelfFulfilled: true → false" row instead of one opaque
// "shipping: [object] → [object]" entry covering the whole sub-document.
// Arrays and Dates are treated as leaf values, not recursed into.
function pushDiff(changes, fieldPath, from, to) {
  const same =
    from === to ||
    (from != null && to != null && JSON.stringify(from) === JSON.stringify(to));

  if (same) return;

  if (isPlainObject(from) || isPlainObject(to)) {
    const fromObj = isPlainObject(from) ? from : {};
    const toObj = isPlainObject(to) ? to : {};
    const keys = new Set([...Object.keys(fromObj), ...Object.keys(toObj)]);

    for (const key of keys) {
      pushDiff(changes, `${fieldPath}.${key}`, fromObj[key], toObj[key]);
    }
    return;
  }

  changes.push({ field: fieldPath, from: from ?? null, to: to ?? null });
}

export function diffFields(before, after, fields) {
  const changes = [];

  for (const field of fields) {
    pushDiff(changes, field, before?.[field], after?.[field]);
  }

  return changes;
}

// skipIfNoChanges: true is for update-style actions (product edit, coupon
// edit, ...) — a save that touched none of the tracked fields shouldn't
// leave a content-free log entry. Create/delete/toggle/trigger actions have
// no "before" state to diff against at all, so they pass changes:[] and
// leave skipIfNoChanges at its default (false) to log unconditionally.
export async function logActivity({
  admin,
  action,
  targetType,
  targetId,
  targetLabel,
  changes = [],
  skipIfNoChanges = false,
}) {
  if (skipIfNoChanges && !changes.length) return;

  try {
    await AuditLog.create({
      admin: admin._id,
      adminName: admin.fullName,
      adminEmail: admin.email ?? null,
      action,
      targetType,
      targetId,
      targetLabel,
      changes,
    });
  } catch (err) {
    logger.error("Failed to write audit log", { action, targetType, targetId: String(targetId), err });
  }
}
