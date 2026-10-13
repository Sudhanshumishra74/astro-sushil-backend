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

  return Number(rates[key] || 0);
};
