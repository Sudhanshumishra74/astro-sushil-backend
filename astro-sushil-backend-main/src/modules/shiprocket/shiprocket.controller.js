import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { applyShipmentStatusUpdate, applyReturnStatusUpdate } from "./shiprocketTracking.service.js";
import { getShiprocketConfig } from "../../config/shiprocket.js";
import logger from "../../utils/logger.js";

/**
 * Shiprocket webhook receiver. Auth is a dashboard-configured shared token
 * compared against a request header (Shiprocket doesn't sign webhooks with
 * HMAC over the raw body the way Razorpay does), so this sits after the
 * normal JSON body parser — no raw-body mounting needed.
 *
 * Field names below (`awb`, `current_status_id`) are the commonly
 * documented Shiprocket webhook shape — this hasn't been verified against
 * a real payload yet (no live credentials at time of writing). Send a test
 * webhook from the Shiprocket dashboard once configured and adjust the
 * extraction below if the real payload differs — see the plan's
 * Verification section.
 */
export const shiprocketWebhook = asyncHandler(async (req, res) => {
  const receivedToken = req.headers["x-api-key"] || req.headers["x-webhook-token"];
  const { webhookToken } = await getShiprocketConfig();

  if (webhookToken && receivedToken !== webhookToken) {
    throw new ApiError(401, "Invalid webhook token");
  }

  const body = req.body || {};
  const awb = body.awb || body.awb_code || null;
  const shiprocketShipmentId = body.shipment_id || null;
  const statusCode = body.current_status_id ?? body.status_code ?? null;

  if (!awb && !shiprocketShipmentId) {
    logger.warn(`[shiprocket-webhook] payload missing awb/shipment_id: ${JSON.stringify(body)}`);
    return res.json(new ApiResponse(200, null, "Ignored — no identifying field in payload"));
  }

  // A given AWB belongs to exactly one of these — try the (more common)
  // forward shipment first, fall back to a return shipment.
  const forwardResult = await applyShipmentStatusUpdate({ awb, shiprocketShipmentId, statusCode });

  if (!forwardResult && awb) {
    await applyReturnStatusUpdate({ awb, statusCode });
  }

  res.json(new ApiResponse(200, null, "OK"));
});
