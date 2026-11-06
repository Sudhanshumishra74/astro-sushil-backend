import { Product } from "../products/product.modal.js";
import Setting from "../Setting/Setting.model.js";
import { getShippingRates } from "../../service/shiprocket.js";
import { getShiprocketConfig, isShiprocketConfigured } from "../../config/shiprocket.js";
import { estimatePackage } from "./packaging.js";
import { getCache, setCache } from "../../utils/cache.js";
import logger from "../../utils/logger.js";

export const FLAT_SELF_SHIPPING_FALLBACK = 500;

// A real quote/unserviceable answer is cached longer than a fallback — the
// fallback branch usually means something is transiently wrong (Shiprocket
// down, misconfigured), and pinning that for 30 minutes would keep charging
// the flat rate well after the underlying issue clears. The 30-minute hold
// on a real quote is also what keeps the checkout-preview quote and the
// order-creation quote consistent for the same cart/address/weight.
const SUCCESS_TTL_SECONDS = 1800;
const FALLBACK_TTL_SECONDS = 120;

// Same fulfillment-type rule as getFulfillmentType in fulfillment.service.js
// (kept independent since that file pulls in a much heavier import graph
// than this plain price calculation needs).
function isSelfFulfilled(product) {
  return product?.type === "physical";
}

/**
 * Resolves what a cart/order's self-fulfilled physical items should be
 * charged for shipping — a real Shiprocket-quoted rate for the cheapest
 * serviceable courier once a delivery pincode is known, or a flat fallback
 * when it isn't (yet) or Shiprocket can't be reached.
 *
 * `result.source`:
 *   - "none"          — no self-fulfilled physical items in `items`; amount 0.
 *   - "disabled"       — admin has turned off shipping charges for
 *                         self-fulfilled orders entirely (Setting.shipping.
 *                         chargeSelfFulfilled); amount 0, no Shiprocket call.
 *   - "flat"           — no destination yet, Shiprocket unconfigured, or the
 *                         API call itself failed — amount is the flat fallback.
 *   - "unserviceable"  — a real destination was checked and no courier can
 *                         serve it; amount is null. Callers must treat this
 *                         as blocking, never charge the flat fallback for it.
 *   - "shiprocket"     — a real quote; amount is the cheapest courier's rate.
 */
export async function resolveSelfShippingCost({ items, deliveryPincode, cod = 0, products = null }) {
  const productIds = items.map((item) => item.product?._id || item.product);

  const productList =
    products ??
    (await Product.find({ _id: { $in: productIds } }).select("type source weight dimensions variants"));

  const productMap = new Map(productList.map((p) => [String(p._id), p]));

  const selfItems = items
    .map((item) => ({ ...item, product: productMap.get(String(item.product?._id || item.product)) }))
    .filter((item) => isSelfFulfilled(item.product));

  if (!selfItems.length) {
    return { amount: 0, source: "none" };
  }

  const settings = await Setting.findOne().select("shipping.chargeSelfFulfilled").lean();
  if (settings?.shipping?.chargeSelfFulfilled === false) {
    return { amount: 0, source: "disabled" };
  }

  const weightKg = Math.round(estimatePackage(selfItems).weight * 100) / 100;

  if (!deliveryPincode) {
    return { amount: FLAT_SELF_SHIPPING_FALLBACK, source: "flat", reason: "no-destination", weightKg };
  }

  if (!(await isShiprocketConfigured())) {
    return { amount: FLAT_SELF_SHIPPING_FALLBACK, source: "flat", reason: "unconfigured", weightKg };
  }

  const { pickupPincode } = await getShiprocketConfig();

  if (!pickupPincode) {
    return { amount: FLAT_SELF_SHIPPING_FALLBACK, source: "flat", reason: "no-pickup-pincode", weightKg };
  }

  const cacheKey = `shiprocket:rate:${pickupPincode}:${deliveryPincode}:${weightKg}:${cod}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    logger.info(`[shipping-quote] cache HIT for ${cacheKey} -> ${JSON.stringify(cached)}`);
    return cached;
  }

  const payload = { pickupPincode, deliveryPincode, weightKg, cod };
  logger.info(`[shipping-quote] Shiprocket serviceability request: ${JSON.stringify(payload)}`);

  let rates;
  try {
    rates = await getShippingRates(payload);
    logger.info(`[shipping-quote] Shiprocket serviceability response: ${JSON.stringify(rates)}`);
  } catch (err) {
    logger.error(`[shipping-quote] Shiprocket serviceability call failed: ${err.message}`);
    const result = { amount: FLAT_SELF_SHIPPING_FALLBACK, source: "flat", reason: "api-error", weightKg };
    await setCache(cacheKey, result, FALLBACK_TTL_SECONDS);
    return result;
  }

  if (!rates?.length) {
    const result = { amount: null, source: "unserviceable", weightKg };
    logger.info(`[shipping-quote] no couriers returned -> ${JSON.stringify(result)}`);
    await setCache(cacheKey, result, SUCCESS_TTL_SECONDS);
    return result;
  }

  const cheapest = [...rates].sort((a, b) => Number(a.rate) - Number(b.rate))[0];
  const amount = Math.ceil(Number(cheapest.rate));

  if (!Number.isFinite(amount) || amount <= 0) {
    const result = { amount: FLAT_SELF_SHIPPING_FALLBACK, source: "flat", reason: "bad-rate", weightKg };
    logger.info(`[shipping-quote] cheapest courier had an unusable rate (${cheapest.rate}) -> ${JSON.stringify(result)}`);
    await setCache(cacheKey, result, FALLBACK_TTL_SECONDS);
    return result;
  }

  const result = {
    amount,
    source: "shiprocket",
    courierId: cheapest.courier_company_id ?? null,
    courierName: cheapest.courier_name ?? null,
    etd: cheapest.etd || cheapest.estimated_delivery_days || null,
    weightKg,
  };

  logger.info(`[shipping-quote] resolved -> ${JSON.stringify(result)} (chose cheapest of ${rates.length} couriers)`);
  await setCache(cacheKey, result, SUCCESS_TTL_SECONDS);
  return result;
}
