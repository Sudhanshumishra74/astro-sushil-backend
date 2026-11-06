import { redisConnection } from "../config/redis.js";
import Redis from "ioredis";

const TTL = 24 * 60 * 60; // 86400 seconds

const redis = new Redis(redisConnection);

export const getExchangeRates = async () => {
  const cached = await redis.get("exchange_rates");

  if (cached) {
    return JSON.parse(cached);
  }

  const key = process.env.EXCHANGE_RATE_API_KEY;
  if (!key) {
    throw new Error("Missing EXCHANGE_RATE_API_KEY in env");
  }

  const url = `https://v6.exchangerate-api.com/v6/${key}/latest/INR`;

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok || data?.result !== "success") {
    throw new Error("Failed to fetch exchange rates");
  }

  await redis.set("exchange_rates", JSON.stringify(data), "EX", TTL);

  return data;
};

export const getRateFor = async (currency) => {
  const data = await getExchangeRates();

  const rates = data.conversion_rates || {};
  const key = (currency || "INR").toUpperCase();

  if (key === "INR") {
    return 1;
  }

  // A missing/renamed currency key used to fall through as `0`, and
  // createOrder's `Number(await getRateFor(...)) || 1` turned that into a
  // silent 1:1 INR rate — an order priced in a foreign currency but charged
  // as if 1 unit of it equalled 1 INR, with nothing on the order
  // distinguishing that from a genuinely INR-priced one. Throwing here
  // means a bad/missing rate fails the order cleanly instead of
  // mispricing it.
  const rate = Number(rates[key]);
  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`No exchange rate available for currency "${key}"`);
  }

  return rate;
};
