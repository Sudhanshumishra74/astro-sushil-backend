import { Shipment } from "../Shipment/shipment.model.js";
import { Return } from "../Return/return.model.js";
import { trackShipmentByAWB } from "../../service/shiprocket.js";
import { applyShipmentStatusUpdate, applyReturnStatusUpdate } from "./shiprocketTracking.service.js";
import { SHIPROCKET_TERMINAL_STATUSES } from "./shiprocketStatusCodes.js";
import logger from "../../utils/logger.js";

// Once a return reaches the warehouse there's nothing more for Shiprocket
// tracking to report — everything past this point is an admin decision
// (inspection, refund, rejection), so polling stops here too.
const RETURN_TERMINAL_FOR_POLLING = new Set([
  "received",
  "inspection_pending",
  "approved_for_refund",
  "rejected",
  "refunded",
]);

async function pollForwardShipments() {
  const terminal = [...SHIPROCKET_TERMINAL_STATUSES];

  const shipments = await Shipment.find({
    fulfillmentType: "self",
    awb: { $ne: null },
    status: { $nin: terminal },
  }).select("_id awb");

  let checked = 0;
  let updated = 0;
  let failed = 0;

  for (const shipment of shipments) {
    checked += 1;

    try {
      const track = await trackShipmentByAWB(shipment.awb);
      if (!track) continue;

      const result = await applyShipmentStatusUpdate({ awb: shipment.awb, statusCode: track.statusCode });
      if (result) updated += 1;
    } catch (err) {
      failed += 1;
      logger.error(`[shiprocket-tracking-sync] AWB ${shipment.awb} check failed: ${err.message}`);
    }
  }

  return { checked, updated, failed };
}

async function pollReturnShipments() {
  const terminal = [...RETURN_TERMINAL_FOR_POLLING];

  const returns = await Return.find({
    awb: { $ne: null },
    status: { $nin: terminal },
  }).select("_id awb");

  let checked = 0;
  let updated = 0;
  let failed = 0;

  for (const returnEntry of returns) {
    checked += 1;

    try {
      const track = await trackShipmentByAWB(returnEntry.awb);
      if (!track) continue;

      const result = await applyReturnStatusUpdate({ awb: returnEntry.awb, statusCode: track.statusCode });
      if (result) updated += 1;
    } catch (err) {
      failed += 1;
      logger.error(`[shiprocket-tracking-sync] return AWB ${returnEntry.awb} check failed: ${err.message}`);
    }
  }

  return { checked, updated, failed };
}

/**
 * Polling fallback for shipment + return tracking — catches anything the
 * webhook missed (webhook configured late, delivery attempt outside webhook
 * coverage, etc., same rationale as the reference client's own comment on
 * trackShipmentByAWB). Only polls shipments/returns that have an AWB and
 * haven't reached a terminal status yet.
 */
export async function runShiprocketTrackingSync() {
  const forward = await pollForwardShipments();
  const returns = await pollReturnShipments();

  const summary = { forward, returns };
  logger.info(`[shiprocket-tracking-sync] complete: ${JSON.stringify(summary)}`);
  return summary;
}
