// Canonical mapping of Shiprocket's numeric shipment status codes to a
// stable internal slug. Tracking sync (webhook + polling) MUST match on
// this numeric code, never on Shiprocket's raw human-readable status text
// (`current_status`) — the text has been observed to vary in casing/wording
// across endpoints, while the numeric code is the stable contract.
export const SHIPROCKET_STATUS_CODES = {
  6: "shipped",
  7: "delivered",
  8: "cancelled",
  9: "rto_initiated",
  10: "rto_delivered",
  12: "lost",
  13: "pickup_error",
  14: "rto_acknowledged",
  15: "pickup_rescheduled",
  16: "cancellation_requested",
  17: "out_for_delivery",
  18: "in_transit",
  19: "out_for_pickup",
  20: "pickup_exception",
  21: "undelivered",
  22: "delayed",
  23: "partially_delivered",
  24: "destroyed",
  25: "damaged",
  26: "fulfilled",
  27: "pickup_booked",
  38: "reached_destination_hub",
  39: "misrouted",
  40: "rto_ndr",
  41: "rto_ofd",
  42: "picked_up",
  43: "self_fulfilled",
  44: "disposed_off",
  45: "cancelled_before_dispatch",
  46: "rto_in_transit",
  47: "qc_failed",
  48: "reached_warehouse",
  49: "custom_cleared",
  50: "in_flight",
  51: "handover_to_courier",
  52: "shipment_booked",
  54: "in_transit_overseas",
  55: "connection_aligned",
  56: "reached_overseas_warehouse",
  57: "custom_cleared_overseas",
  59: "box_packing",
  60: "fc_allocated",
  61: "picklist_generated",
  62: "ready_to_pack",
  63: "packed",
  67: "fc_manifest_generated",
  68: "processed_at_warehouse",
  71: "handover_exception",
  72: "packed_exception",
  75: "rto_lock",
  76: "untraceable",
  77: "issue_related_to_recipient",
  78: "reached_back_at_seller_city",
};

// Statuses that mean "nothing more will change" — the tracking-sync polling
// job skips shipments already in one of these so it isn't polling delivered
// orders forever.
export const SHIPROCKET_TERMINAL_STATUSES = new Set([
  "delivered",
  "cancelled",
  "rto_delivered",
  "lost",
  "destroyed",
  "disposed_off",
  "cancelled_before_dispatch",
]);

// The lowest code this table maps ("shipped"). Shiprocket's codes are
// otherwise a monotonically increasing lifecycle (order created ->
// processing -> pickup -> shipped -> delivered), so anything below this is
// necessarily a pre-shipment stage even when the exact number isn't in the
// table above. Not asserting specific per-code labels for that early range
// (e.g. which number means "invoiced" vs. "ready to ship") since that
// hasn't been verified against a real payload yet — same caveat as the
// webhook field names in shiprocket.controller.js — but bucketing them as
// "processing" beats surfacing a bare "unknown" for a perfectly normal
// pre-shipment order to admin/customer UI.
const LOWEST_MAPPED_CODE = 6;

/**
 * Resolves a Shiprocket numeric status code to its canonical slug. Returns
 * "unknown" (never throws) for a code not yet in the table — Shiprocket can
 * introduce new codes at any time; the raw numeric code is always retained
 * on the shipment regardless, so nothing is lost even when the slug is
 * "unknown".
 */
export function resolveShiprocketStatus(code) {
  const numeric = Number(code);
  if (!Number.isFinite(numeric)) return "unknown";
  if (SHIPROCKET_STATUS_CODES[numeric]) return SHIPROCKET_STATUS_CODES[numeric];
  if (numeric > 0 && numeric < LOWEST_MAPPED_CODE) return "processing";
  return "unknown";
}

// The return lifecycle's business vocabulary (Order.returns[].status)
// doesn't match the forward-shipment slug vocabulary 1:1 — notably
// Shiprocket's "delivered" on a *reverse* shipment means delivered to OUR
// warehouse, which is the return status "received", not a customer-facing
// delivery. Statuses not listed here (e.g. intermediate warehouse-internal
// codes) simply don't move the return's business status — the raw
// numeric code is still recorded on the return for audit regardless.
const FORWARD_SLUG_TO_RETURN_STATUS = {
  pickup_booked: "pickup_scheduled",
  pickup_rescheduled: "pickup_scheduled",
  picked_up: "picked_up",
  in_transit: "in_transit",
  reached_destination_hub: "in_transit",
  reached_warehouse: "received",
  delivered: "received",
  fulfilled: "received",
  processed_at_warehouse: "received",
};

/**
 * Resolves a Shiprocket numeric status code to a return-lifecycle business
 * status (see Order.returns[].status enum), or null if this code doesn't
 * correspond to a return-status transition (still worth recording the raw
 * code, just doesn't move the business status).
 */
export function resolveReturnStatus(code) {
  const forwardSlug = resolveShiprocketStatus(code);
  return FORWARD_SLUG_TO_RETURN_STATUS[forwardSlug] || null;
}
