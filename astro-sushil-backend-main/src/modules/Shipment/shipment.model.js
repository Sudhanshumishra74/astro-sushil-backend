import mongoose from "mongoose";
import { shipmentItemSchema, shipmentStatusHistorySchema } from "../Fulfillment/fulfillment.schemas.js";

const shipmentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    fulfillmentType: { type: String, enum: ["self"], required: true },

    items: { type: [shipmentItemSchema], default: [] },

    // Shiprocket
    shiprocketOrderId: { type: String, default: null },
    shiprocketShipmentId: { type: String, default: null },
    courier: { type: String, default: null },
    awb: { type: String, default: null, index: true },
    trackingUrl: { type: String, default: null },
    labelUrl: { type: String, default: null },

    edd: { type: String, default: null },

    // The actual rate Shiprocket bills for the courier assigned to this
    // shipment (courier/serviceability's `.rate` for whichever courier
    // createSelfShipment picked) — independent of Order.selfShippingAmount/
    // shippingQuote, which is what the CUSTOMER was charged at checkout and
    // can differ (a promo, a stale quote, a since-changed rate card). This
    // is what the business actually pays Shiprocket for this shipment.
    courierCharge: { type: Number, default: null },

    // Canonical status slug (see shiprocketStatusCodes.js) — never derived
    // from Shiprocket's raw status text, only from the numeric code below.
    status: { type: String, default: "pending" },
    statusCode: { type: Number, default: null },
    statusHistory: { type: [shipmentStatusHistorySchema], default: [] },

    error: { type: String, default: null },
  },
  { timestamps: true },
);

export const Shipment =
  mongoose.models.Shipment || mongoose.model("Shipment", shipmentSchema);
