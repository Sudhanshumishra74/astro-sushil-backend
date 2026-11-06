import Setting from "../modules/Setting/Setting.model.js";

// Infra-level fields only — not admin-editable, doesn't change at runtime.
export const shiprocketConfig = {
  baseUrl: process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1/external",
  trackingSyncCron: process.env.SHIPROCKET_TRACKING_SYNC_CRON || "*/30 * * * *",
  requestTimeoutMs: 30000,
};

// Business-configurable fields, editable from the admin panel (Settings >
// Shiprocket — see Setting.model.js's `shiprocket` block). The DB value
// wins whenever it's set; the SHIPROCKET_* env vars are only a fallback for
// whatever hasn't been configured via the admin panel yet.
export async function getShiprocketConfig() {
  const settings = await Setting.findOne().select("shiprocket").lean();
  const db = settings?.shiprocket || {};

  return {
    email: db.email || process.env.SHIPROCKET_EMAIL || "",
    password: db.password || process.env.SHIPROCKET_PASSWORD || "",
    webhookToken: db.webhookToken || process.env.SHIPROCKET_WEBHOOK_TOKEN || "",
    // The pickup nickname is what Shiprocket's create-order API wants; the
    // pincode is needed separately for rate-shopping (getShippingRates) —
    // Shiprocket has no "resolve nickname to pincode" endpoint in this client.
    pickupLocation: db.pickupLocation || process.env.SHIPROCKET_PICKUP_LOCATION || "",
    pickupPincode: db.pickupPincode || process.env.SHIPROCKET_PICKUP_PINCODE || "",
    // A reverse-pickup order's "shipping" (delivery) destination is OUR
    // warehouse, not the customer — Shiprocket's /orders/create/return
    // payload wants a full destination address, not just a pincode.
    warehouseName: db.warehouseName || process.env.SHIPROCKET_WAREHOUSE_NAME || "Warehouse",
    warehouseEmail: db.warehouseEmail || process.env.SHIPROCKET_WAREHOUSE_EMAIL || "",
    warehousePhone: db.warehousePhone || process.env.SHIPROCKET_WAREHOUSE_PHONE || "",
    warehouseAddress: db.warehouseAddress || process.env.SHIPROCKET_WAREHOUSE_ADDRESS || "",
    warehouseCity: db.warehouseCity || process.env.SHIPROCKET_WAREHOUSE_CITY || "",
    warehouseState: db.warehouseState || process.env.SHIPROCKET_WAREHOUSE_STATE || "",
    warehousePincode: db.warehousePincode || process.env.SHIPROCKET_WAREHOUSE_PINCODE || "",
  };
}

export async function isShiprocketConfigured() {
  const { email, password } = await getShiprocketConfig();
  return Boolean(email && password);
}
