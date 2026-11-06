import express from "express";
import { shiprocketWebhook } from "./shiprocket.controller.js";

const router = express.Router();

// Admin-facing shipment/return management now lives at /shipments and
// /returns (see src/modules/Shipment, src/modules/Return) — this module is
// scoped to just the courier-specific inbound webhook.
router.post("/webhook", shiprocketWebhook);

export default router;
