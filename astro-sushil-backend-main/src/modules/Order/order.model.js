import mongoose from "mongoose";
import { shipmentItemSchema, shipmentStatusHistorySchema } from "../Fulfillment/fulfillment.schemas.js";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Cascading second level — set only when the ordered variant had
    // sub-variants (see product.modal.js's variantSchema).
    subVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Snapshot of the ordered variant/sub-variant's own name+value (e.g.
    // "Size"/"XL") — permanent record of what was actually ordered. Needed
    // because variantId/subVariantId alone give the admin/customer order
    // views no human-readable way to show which option was bought.
    variantName: { type: String, default: null },
    variantValue: { type: String, default: null },
    subVariantName: { type: String, default: null },
    subVariantValue: { type: String, default: null },

    // Set only for a soldByRatti (gemstone) product — see
    // product.modal.js/utils/ratti.js. price/mrp above are already the
    // per-line total for this ratti, not a per-1-ratti rate.
    selectedRatti: { type: Number, default: null },

    // Snapshot of the certificate chosen at order time (see
    // cart.modal.js's matching fields) — certificatePrice is the extra
    // charge only (0 when certificateIncludedInPrice), already converted to
    // the order's currency same as taxAmount below.
    certificateId: { type: mongoose.Schema.Types.ObjectId, default: null },
    certificateName: { type: String, default: null },
    certificatePrice: { type: Number, default: 0 },
    certificateIncludedInPrice: { type: Boolean, default: false },

    name: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    mrp: {
      type: Number,
      default: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    image: {
      type: String,
      default: null,
    },

    taxRate: {
      type: Number,
      default: 0,
    },

    taxType: {
      type: String,
      enum: ["inclusive", "exclusive"],
      default: "exclusive",
    },

    taxAmount: {
      type: Number,
      default: 0,
    },

    source: { type: String, enum: ["internal"], default: "internal" },

    // Snapshot of the product's own `type` at order time (product.modal.js)
    // — an order's top-level `orderType` collapses to "physical" whenever
    // ANY item is physical, even one mixed in alongside digital items, so
    // it alone can't tell the admin Orders list whether an order is really
    // "physical", "digital", or a mix of both. Missing on orders placed
    // before this field existed — callers should treat a missing value as
    // "unknown, assume physical" for backward compatibility, not crash.
    type: { type: String, enum: ["physical", "digital", "service"], default: null },

    // Running total of units already returned for this line — checked
    // against `quantity` on every new return request. Only incremented on
    // return *approval* (not on request), so a rejected/abandoned request
    // never locks the units.
    returnedQuantity: { type: Number, default: 0 },
  },
  // Was `_id: false` — every order-item lookup across the return pipeline
  // (findOrderItem, restockReturnedItems, processReturnRefund,
  // adjustReturnedQuantity) matched by product id alone, with no way to
  // tell apart two lines for the *same* product with different
  // variant/design/metal selections (e.g. the same ring in two sizes) —
  // always resolving to whichever line happened to come first, silently
  // refunding/restocking the wrong one. A real per-line id lets the return
  // flow reference the exact line instead. Only new order items get one
  // going forward — Mongoose doesn't retroactively add `_id` to documents
  // already stored without it, so older orders' items still fall back to
  // product-id matching.
);

const paymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ["cod", "razorpay"],
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },

    status: {
      type: String,
      enum: ["pending", "paid", "failed", "partially_refunded", "refunded"],
      default: "pending",
    },

    transactionId: {
      type: String,
      default: null,
    },

    razorpayOrderId: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: String,
    phone: String,
    pincode: String,
    state: String,
    city: String,
    addressLine1: String,
    addressLine2: String,
    landmark: String,
  },
  { _id: false },
);

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      default: null,
    },

    discountAmount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

// Shipments and returns live in their own top-level collections
// (Shipment/Return models) so they get real _ids and can be queried/managed
// directly (see /shipments, /returns admin APIs). These summary schemas are
// a full, denormalized mirror of those canonical documents, kept in sync via
// orderSync.js on every write — so the admin order-detail screen renders
// everything inline without a second API call. `shipmentId`/`returnId`
// point at the canonical doc for anyone who does need it directly.
const shipmentSummarySchema = new mongoose.Schema(
  {
    shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Shipment", required: true },

    fulfillmentType: { type: String, enum: ["self"], required: true },

    items: { type: [shipmentItemSchema], default: [] },

    // Shiprocket (fulfillmentType: "self")
    shiprocketOrderId: { type: String, default: null },
    shiprocketShipmentId: { type: String, default: null },
    courier: { type: String, default: null },
    awb: { type: String, default: null },
    trackingUrl: { type: String, default: null },
    labelUrl: { type: String, default: null },
    edd: { type: String, default: null },

    // Mirrors Shipment.courierCharge — the actual rate Shiprocket bills for
    // the assigned courier, separate from what the customer was charged
    // (that's Order.selfShippingAmount/shippingQuote above).
    courierCharge: { type: Number, default: null },

    // Canonical status slug (see shiprocketStatusCodes.js) — never derived
    // from Shiprocket's raw status text, only from the numeric code below.
    status: { type: String, default: "pending" },
    statusCode: { type: Number, default: null },
    statusHistory: { type: [shipmentStatusHistorySchema], default: [] },

    error: { type: String, default: null },

    // Copied from the canonical Shipment doc's own timestamps — NOT
    // Mongoose-managed here, since that would re-stamp `updatedAt` to "when
    // the order was saved" instead of "when the shipment itself changed".
    createdAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const returnSummarySchema = new mongoose.Schema(
  {
    returnId: { type: mongoose.Schema.Types.ObjectId, ref: "Return", required: true },

    fulfillmentType: { type: String, enum: ["self"], required: true },
    originShipmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Shipment", default: null },
    items: { type: [shipmentItemSchema], default: [] },

    reason: { type: String, default: null },
    customerComment: { type: String, default: null },

    // Shiprocket reverse shipment
    shiprocketReturnOrderId: { type: String, default: null },
    shiprocketReturnShipmentId: { type: String, default: null },
    courier: { type: String, default: null },
    awb: { type: String, default: null },
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

    // Mirrors Return.razorpayRefundId/refundMethod/refundedAt.
    razorpayRefundId: { type: String, default: null },
    refundMethod: { type: String, default: null },
    refundedAt: { type: Date, default: null },

    // Free-text admin annotation on any transition (rejection reason, retry
    // note, refund note) — distinct from `inspection.notes`, which is
    // specifically the warehouse-inspection outcome note.
    adminNote: { type: String, default: null },

    error: { type: String, default: null },
    requestedAt: { type: Date, default: Date.now },
    receivedAt: { type: Date, default: null },

    // Copied from the canonical Return doc's own timestamps — NOT
    // Mongoose-managed here, same reasoning as shipmentSummarySchema above.
    createdAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Client-generated per-checkout-attempt token (see createOrder) — a
    // sparse unique index scoped per-user means a retried/duplicated
    // request carrying the SAME key can never insert a second order, even
    // under concurrent requests, without needing an app-level lock.
    idempotencyKey: {
      type: String,
      default: null,
    },

    items: {
      type: [orderItemSchema],
      required: true,
    },

    orderType: {
      type: String,
      enum: ["physical", "digital"],
      required: true,
    },

    addressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      default: null,
    },

    shippingAddress: {
      type: shippingAddressSchema,
      default: null,
    },

    subTotal: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    shipping: {
      type: Number,
      default: 0,
    },

    // Snapshot of what actually priced the `shipping` amount above, for
    // self-fulfilled physical orders — see shippingQuote.service.js's
    // resolveSelfShippingCost. Independent of whatever courier
    // fulfillment.service.js's createSelfShipment separately books after
    // payment; rates can drift between checkout and booking, this is an
    // audit trail for that gap, not a guarantee they match.
    shippingQuote: {
      source: { type: String, enum: ["none", "disabled", "flat", "shiprocket"], default: null },
      courierId: { type: String, default: null },
      courierName: { type: String, default: null },
      etd: { type: String, default: null },
      weightKg: { type: Number, default: null },
      amount: { type: Number, default: null },
    },

    // Breakdown of the combined `shipping` total above, by fulfillment
    // source — set once at order creation (see order.controller.js),
    // always summing to `shipping`. Whether this is *displayed* as one
    // merged line or two separate ones is a live admin preference
    // (Setting.shipping.displayMode), not snapshotted here.
    selfShippingAmount: { type: Number, default: 0 },

    tax: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
    },

    baseCurrency: {
      type: String,
      default: "INR",
      uppercase: true,
    },

    baseAmount: {
      type: Number,
      default: 0,
    },

    exchangeRate: {
      type: Number,
      default: 1,
    },

    coupon: {
      type: couponSchema,
      default: null,
    },

    // Assigned once, the first time this order's invoice is actually
    // viewed/downloaded (see utils/invoiceSequence.js) — not at order
    // creation, so an order that's cancelled before anyone ever opens its
    // invoice never burns a number.
    invoiceNumber: { type: String, default: null },

    orderStatus: {
      type: String,
      enum: [
        "payment_pending",
        "placed",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "payment_failed",
      ],
      default: "payment_pending",
    },

    payment: {
      type: paymentSchema,
      required: true,
    },

    shipments: { type: [shipmentSummarySchema], default: [] },
    returns: { type: [returnSummarySchema], default: [] },
  },
  {
    timestamps: true,
  },
);

// Sparse: only orders that actually sent an idempotencyKey are indexed, so
// older orders (and any future caller that omits it) never collide on the
// shared `null` value.
orderSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

export const Order =
  mongoose.models.Order || mongoose.model("Order", orderSchema);
