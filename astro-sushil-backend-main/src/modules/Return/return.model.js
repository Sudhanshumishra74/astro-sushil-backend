import mongoose from "mongoose";
import { shipmentItemSchema, shipmentStatusHistorySchema } from "../Fulfillment/fulfillment.schemas.js";

// Reverse logistics for self-fulfilled items; digital items aren't
// physically returnable so never reach here. `originShipmentId` links back
// to the Shipment these items were dispatched on, so eligibility
// (delivered? within the return window?) can be checked against that
// shipment's own status history. Returns go through Shiprocket's
// reverse-pickup API.
const returnSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    fulfillmentType: { type: String, enum: ["self"], required: true },
    originShipmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Shipment", default: null },
    items: { type: [shipmentItemSchema], default: [] },

    reason: { type: String, default: null },
    customerComment: { type: String, default: null },

    // Shiprocket reverse shipment
    shiprocketReturnOrderId: { type: String, default: null },
    shiprocketReturnShipmentId: { type: String, default: null },
    courier: { type: String, default: null },
    awb: { type: String, default: null, index: true },
    trackingUrl: { type: String, default: null },

    // Business lifecycle — distinct from the raw Shiprocket-resolved slug;
    // see resolveReturnStatus() in shiprocketStatusCodes.js.
    status: {
      type: String,
      enum: [
        "requested",
        "approved",
        "pickup_scheduled",
        "picked_up",
        "in_transit",
        "received",
        "inspection_pending",
        "approved_for_refund",
        "rejected",
        "refunded",
      ],
      default: "requested",
    },
    statusCode: { type: Number, default: null }, // raw Shiprocket numeric code, audit only
    statusHistory: { type: [shipmentStatusHistorySchema], default: [] },

    inspection: {
      passed: { type: Boolean, default: null },
      notes: { type: String, default: null },
      inspectedAt: { type: Date, default: null },
      inspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    },

    refundAmount: { type: Number, default: null },
    refundIncludesShipping: { type: Boolean, default: false },
    refundTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },

    // Denormalized off the refund Transaction (same reasoning as
    // courier/awb above — everything the admin/customer return screens
    // need is right here, no populate/second query required).
    razorpayRefundId: { type: String, default: null },
    refundMethod: { type: String, enum: ["razorpay", "manual"], default: null },
    refundedAt: { type: Date, default: null },

    // Assigned once, the first time this return's credit note is actually
    // viewed/downloaded (see utils/invoiceSequence.js) — only reachable once
    // status is "refunded" anyway (renderCreditNotePdf enforces that).
    creditNoteNumber: { type: String, default: null },

    // Free-text admin annotation on any transition (rejection reason, retry
    // note, refund note) — distinct from `inspection.notes`, which is
    // specifically the warehouse-inspection outcome note.
    adminNote: { type: String, default: null },

    error: { type: String, default: null },
    requestedAt: { type: Date, default: Date.now },
    receivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Return =
  mongoose.models.Return || mongoose.model("Return", returnSchema);
