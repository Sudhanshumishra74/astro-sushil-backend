// Shiprocket API client with persistent JWT token caching.
//
// Token lifetime: Shiprocket tokens are valid for 14 days.
// Cache strategy (3 layers, fastest first):
//   1. Module-level memory — avoids DB hit on every request within the same process
//   2. MongoDB ShiprocketAuth — survives server restarts; only 1 login per 13 days
//   3. Shiprocket /auth/login — called only when both caches are expired/empty
//
// All public functions are async and throw on non-2xx responses.

import { ShiprocketAuth } from "../modules/shiprocket/shiprocketAuth.model.js";
import { shiprocketConfig, getShiprocketConfig } from "../config/shiprocket.js";

const BASE_URL = shiprocketConfig.baseUrl;
const TOKEN_TTL_MS = 13 * 24 * 60 * 60 * 1000; // 13 days (1-day buffer before 14-day expiry)
const REQUEST_TIMEOUT_MS = shiprocketConfig.requestTimeoutMs;

// Process-level memory cache (layer 1)
let _token = null;
let _expiresAt = 0;

async function getToken(force = false) {
  const now = Date.now();

  // Layer 1: in-memory (skip on forced refresh)
  if (!force && _token && now < _expiresAt) return _token;

  // Layer 2: MongoDB (skip on forced refresh)
  if (!force) {
    try {
      const config = await ShiprocketAuth.get();
      if (config.token && config.tokenExpiresAt && new Date(config.tokenExpiresAt).getTime() > now) {
        _token = config.token;
        _expiresAt = new Date(config.tokenExpiresAt).getTime();
        return _token;
      }
    } catch (dbErr) {
      console.warn("Shiprocket token: DB read failed, falling back to API login:", dbErr.message);
    }
  }

  const { email, password } = await getShiprocketConfig();

  if (!email || !password) {
    throw new Error(
      "Shiprocket email/password not configured (set via admin panel or SHIPROCKET_EMAIL/SHIPROCKET_PASSWORD)",
    );
  }

  // Layer 3: Shiprocket API login
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shiprocket auth failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  if (!data.token) throw new Error("Shiprocket auth: no token in response");

  const expiresAt = new Date(now + TOKEN_TTL_MS);

  // Persist to DB (non-fatal if it fails)
  try {
    await ShiprocketAuth.findOneAndUpdate(
      { _key: "singleton" },
      { token: data.token, tokenExpiresAt: expiresAt },
      { upsert: true },
    );
  } catch (dbErr) {
    console.warn("Shiprocket token: DB write failed, using memory cache only:", dbErr.message);
  }

  // Update memory cache
  _token = data.token;
  _expiresAt = expiresAt.getTime();

  return _token;
}

// Clears both cache layers so the next getToken() call re-authenticates.
async function invalidateToken() {
  _token = null;
  _expiresAt = 0;
  try {
    await ShiprocketAuth.findOneAndUpdate(
      { _key: "singleton" },
      { token: null, tokenExpiresAt: null },
      { upsert: true },
    );
  } catch {
    // non-fatal — memory cache is already cleared
  }
}

/**
 * Authenticated fetch with automatic token-refresh on 401.
 * Retries exactly once after clearing the cached token.
 */
async function shiprocketFetch(url, options = {}) {
  const makeHeaders = async (force = false) => ({
    Authorization: `Bearer ${await getToken(force)}`,
    "Content-Type": "application/json",
    ...options.headers,
  });

  let res = await fetch(url, { ...options, headers: await makeHeaders() });

  if (res.status === 401) {
    console.warn("Shiprocket 401 — cached token rejected, re-authenticating…");
    await invalidateToken();
    res = await fetch(url, { ...options, headers: await makeHeaders(true) });
  }

  return res;
}

/**
 * Returns available courier companies with rates for the given route.
 * Sorted in the original Shiprocket order (caller should sort by rate).
 *
 * @param {object} opts
 * @param {string|number} opts.pickupPincode
 * @param {string|number} opts.deliveryPincode
 * @param {number}        opts.weightKg       - total shipment weight in kg
 * @param {0|1}           [opts.cod=0]        - 1 for cash-on-delivery
 * @param {boolean}       [opts.isReturn=false] - true for a reverse-pickup
 *   (return) route — filters to couriers Shiprocket has enabled for reverse
 *   logistics on this account, which is not always the same list as forward
 *   shipments for the same pincode pair.
 * @returns {Array} raw Shiprocket available_courier_companies array
 */
export async function getShippingRates({
  pickupPincode,
  deliveryPincode,
  weightKg,
  cod = 0,
  isReturn = false,
}) {
  const params = new URLSearchParams({
    pickup_postcode: String(pickupPincode),
    delivery_postcode: String(deliveryPincode),
    weight: String(weightKg),
    cod: String(cod),
    // Confirmed against the live API: explicitly sending is_return=0 makes
    // Shiprocket reject the request with a 200-status error payload
    // ("Order value needs to be greater than zero") instead of returning
    // couriers — every forward-shipment call was silently getting zero
    // couriers back. Omitting the param entirely gives correct forward
    // results; only send it (as "1") for the actual return-pickup case.
    ...(isReturn && { is_return: "1" }),
  });

  const res = await shiprocketFetch(`${BASE_URL}/courier/serviceability/?${params}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shiprocket serviceability failed (${res.status}): ${body}`);
  }

  const data = await res.json();

  // Shiprocket returns HTTP 200 even for its own request-level errors — the
  // failure only shows up as `{ message, status }` with no `data` key,
  // which `?? []` would otherwise swallow into a silent empty result.
  if (!data.data && data.message) {
    throw new Error(`Shiprocket serviceability error: ${data.message}`);
  }

  return data.data?.available_courier_companies ?? [];
}

/**
 * Creates an order on Shiprocket.
 * Returns the full Shiprocket response (contains order_id, shipment_id, etc.).
 *
 * @param {object} payload - Shiprocket create-order payload
 * @returns {object} Shiprocket response
 */
export async function createShiprocketOrder(payload) {
  const res = await shiprocketFetch(`${BASE_URL}/orders/create/adhoc`, {
    method: "POST",
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shiprocket createOrder failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Assigns an AWB (Air Waybill) and courier to a Shiprocket shipment.
 * Must be called after createShiprocketOrder using the returned shipment_id.
 *
 * @param {string|number} shipmentId  - Shiprocket shipment_id from order creation
 * @param {string|number} courierId   - Courier company ID selected at checkout
 * @returns {object} Shiprocket response (contains awb_code, courier_name)
 */
export async function assignAWB(shipmentId, courierId) {
  const res = await shiprocketFetch(`${BASE_URL}/courier/assign/awb`, {
    method: "POST",
    body: JSON.stringify({
      shipment_id: [String(shipmentId)],
      courier_id: String(courierId),
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shiprocket assignAWB failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Requests a courier pickup from the warehouse for one or more shipments.
 * Call this after AWB assignment. Shiprocket will schedule a pickup slot.
 *
 * @param {Array<string|number>} shipmentIds - Array of Shiprocket shipment_ids
 * @returns {object} Shiprocket response
 */
export async function generatePickup(shipmentIds) {
  const res = await shiprocketFetch(`${BASE_URL}/courier/generate/pickup`, {
    method: "POST",
    body: JSON.stringify({
      shipment_id: shipmentIds.map(String),
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shiprocket generatePickup failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * True when a generatePickup() rejection means "a pickup is already
 * scheduled for this shipment" rather than a real failure — Shiprocket
 * returns this as an HTTP 400 (`{"message":"Already in Pickup Queue."}`),
 * indistinguishable from a genuine error by status code alone, so callers
 * that might retry a shipment which already succeeded once (e.g. an admin
 * clicking Retry on a shipment that has an AWB but still shows "pending"
 * because nothing else has moved it forward yet) need to treat this
 * specific message as the desired end-state already holding, not a
 * failure to surface.
 */
export function isAlreadyInPickupQueueError(err) {
  return /already in pickup queue/i.test(err?.message || "");
}

/**
 * Cancels one or more orders on Shiprocket by their numeric order IDs.
 *
 * @param {Array<string|number>} ids - Shiprocket order IDs (not our orderNumber)
 * @returns {object} Shiprocket response
 */
export async function cancelShiprocketOrders(ids) {
  const res = await shiprocketFetch(`${BASE_URL}/orders/cancel`, {
    method: "POST",
    body: JSON.stringify({ ids: ids.map(Number) }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shiprocket cancelOrders failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Generates a shipping label PDF for one or more shipments.
 * Returns { label_url } — admin opens/downloads from that URL.
 *
 * @param {Array<string|number>} shipmentIds - Shiprocket shipment_ids
 * @returns {object} Shiprocket response (contains label_url)
 */
export async function generateShippingLabel(shipmentIds) {
  const res = await shiprocketFetch(`${BASE_URL}/courier/generate/label`, {
    method: "POST",
    // Shiprocket requires numeric shipment IDs in this array
    body: JSON.stringify({ shipment_id: shipmentIds.map(Number) }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shiprocket generateLabel failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Generates a manifest PDF for one or more Shiprocket orders.
 * Print and hand to the courier at pickup.
 *
 * @param {Array<string|number>} srOrderIds - Shiprocket order IDs (NOT shipment IDs)
 * @returns {object} Shiprocket response (contains manifest_url)
 */
export async function generateManifest(srOrderIds) {
  const res = await shiprocketFetch(`${BASE_URL}/orders/print/manifest`, {
    method: "POST",
    // Manifest uses order_ids (numeric Shiprocket order IDs), not shipment_id
    body: JSON.stringify({ order_ids: srOrderIds.map(Number) }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shiprocket generateManifest failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Fetches the latest tracking status for a single AWB.
 * Used by the tracking-sync cron to reconcile shipments whose status
 * didn't advance via webhook (missed/failed delivery, webhook configured
 * late, etc).
 *
 * NOTE: the exact field Shiprocket nests the numeric status code under
 * hasn't been verified against a live response yet (no SHIPROCKET_* creds
 * configured at the time this was written) — `current_status_id` is the
 * commonly-documented field name; `statusCode` below tries a couple of
 * plausible fallbacks defensively. Confirm against a real response once
 * credentials are available and adjust if it differs — see the plan's
 * Verification section.
 *
 * @param {string} awbCode
 * @returns {object|null} the first shipment_track entry (current_status,
 *   courier_name, etc.) merged with `statusCode` (numeric — feed this into
 *   `resolveShiprocketStatus()`, never the raw `current_status` text) and
 *   `tracking_url` (Shiprocket returns this as a sibling `track_url` field
 *   on `tracking_data`, not inside `shipment_track` itself) — or null if
 *   Shiprocket has no track data yet for this AWB.
 */
export async function trackShipmentByAWB(awbCode) {
  const res = await shiprocketFetch(`${BASE_URL}/courier/track/awb/${encodeURIComponent(awbCode)}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shiprocket trackShipment failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const track = data.tracking_data?.shipment_track?.[0];
  if (!track) return null;

  const statusCode = track.current_status_id ?? track.status_code ?? track.shipment_status ?? null;

  return {
    ...track,
    statusCode,
    tracking_url: data.tracking_data?.track_url || buildTrackingUrl(awbCode),
    // Shiprocket's tracking API returns this as `edd` (estimated delivery
    // date) on the track entry itself — normalise to `edd` explicitly since
    // callers shouldn't need to know the raw field name.
    edd: track.edd || null,
  };
}

/**
 * Shiprocket's own AWB-assignment and tracking APIs don't reliably return a
 * customer-facing tracking URL (undocumented/plan-dependent field), so we
 * construct Shiprocket's public tracking page URL directly from the AWB —
 * deterministic and always available once an AWB exists.
 *
 * @param {string} awbCode
 * @returns {string|null}
 */
export function buildTrackingUrl(awbCode) {
  return awbCode ? `https://shiprocket.co/tracking/${awbCode}` : null;
}

/**
 * Creates a reverse pickup (return) order on Shiprocket. Kept for the
 * returns/reverse-logistics follow-up phase — not called anywhere yet.
 *
 * @param {object} payload
 * @returns {object} Shiprocket response
 */
export async function createReturnPickup(payload) {
  const res = await shiprocketFetch(`${BASE_URL}/orders/create/return`, {
    method: "POST",
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shiprocket createReturnPickup failed (${res.status}): ${body}`);
  }

  return res.json();
}
