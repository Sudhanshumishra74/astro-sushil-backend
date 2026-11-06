import crypto from "crypto";
import mongoose from "mongoose";
import puppeteer from "puppeteer";

import Address from "../Address/address.model.js";
import Cart from "../cart/cart.modal.js";
import { Order } from "./order.model.js";
import { Product } from "../products/product.modal.js";
import { Transaction } from "../Transaction/Transaction.model.js";
import { isValidRatti } from "../../utils/ratti.js";

import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { notificationQueue } from "../../queues/notification.queue.js";
import { createOrderSchema, verifyPaymentSchema } from "./order.validation.js";
import { getRateFor } from "../../utils/exchangeRate.js";
import { generateInvoiceTemplate } from "../../utils/invoice.template.js";
import { ensureSequenceNumber, formatInvoiceNumber } from "../../utils/invoiceSequence.js";
import { createDownloadsFromOrder } from "../Download/download.controller.js";
import {
  processFulfillment,
  cancelShipmentsForOrder,
  syncShipmentsToOrderStatus,
} from "../Fulfillment/fulfillment.service.js";
import { resolveSelfShippingCost } from "../Fulfillment/shippingQuote.service.js";
import { finalizeCodPayment } from "../Fulfillment/orderSync.js";
import { calculateCart, claimCouponUsage, releaseCouponUsage } from "../../common/priceengine.js";
import { User } from "../auth/user.modal.js";
import { createRazorpayOrder, refundRazorpayPayment } from "../../utils/razorpay.js";
import Setting from "../Setting/Setting.model.js";
import logger from "../../utils/logger.js";
import { diffFields, logActivity } from "../AuditLog/auditLog.service.js";

// Mirrors getReturnPolicyDays() in fulfillment.service.js — 0 (or unset)
// means no time limit, only the "not delivered yet" rule in cancelOrder
// applies.
async function getCancellationWindowHours() {
  const settings = await Setting.findOne().select("order.cancellationWindowHours").lean();
  return settings?.order?.cancellationWindowHours ?? 24;
}

// Shared by both places an order can be cancelled — the customer's own
// cancelOrder and the admin's updateOrderStatus. COD is deliberately left
// alone here — payment.status stays "pending" until actual delivery
// (finalizeCodPayment, orderSync.js), so a COD order cancelled before
// delivery never collected any money to refund in the first place. A paid
// Razorpay order did, and nothing else in this codebase issued that refund
// on cancellation before this existed — an order would just sit
// "cancelled" + "paid" forever with no money ever sent back. Mutates
// `order.payment.status` in-memory on success; caller still needs to
// order.save() it. Cancellation itself always proceeds regardless of
// whether this succeeds — the customer/admin already decided to cancel,
// and payment.status deliberately stays "paid" (not "refunded") on failure
// so a cancelled-but-still-"paid" order is a visible signal for manual
// follow-up instead of silently vanishing.
async function refundOrderOnCancellation(order) {
  if (order.payment?.method !== "razorpay" || order.payment?.status !== "paid") {
    return;
  }

  try {
    // Once a self-fulfillment shipment already has an AWB, we've already
    // paid Shiprocket for that pickup — refunding the full order including
    // selfShippingAmount would refund a courier cost we can't get back.
    const selfShippingAlreadyEngaged = (order.shipments || []).some(
      (s) => s.fulfillmentType === "self" && s.awb,
    );
    const refundAmount = selfShippingAlreadyEngaged
      ? Math.max(0, (order.totalAmount || 0) - (order.selfShippingAmount || 0))
      : order.totalAmount;

    const rzpRefund = await refundRazorpayPayment({
      paymentId: order.payment.transactionId,
      amount: refundAmount,
      notes: { orderId: String(order._id), reason: "order_cancelled" },
    });

    const originalTransaction = await Transaction.findOne({
      order: order._id,
      transactionType: "order",
    });

    await Transaction.create({
      user: order.user,
      order: order._id,
      transactionType: "refund",
      amount: refundAmount,
      currency: order.payment?.currency || "INR",
      method: "razorpay",
      status: "success",
      razorpayRefundId: rzpRefund?.id || null,
      refundOf: originalTransaction?._id || null,
      rawResponse: rzpRefund,
    });

    order.payment.status = "refunded";
  } catch (err) {
    console.error(
      { orderId: order._id, err },
      "refundOrderOnCancellation: razorpay refund failed — needs manual follow-up",
    );
  }
}

// Shared claim/release logic for one order item — used both by reduceStock
// (claim, with self-rollback of whatever it already claimed if a later
// item in the same call fails and there's no transaction to do that
// automatically) and restoreStock (unconditional release, for cancelling an
// order whose stock was already fully claimed).
async function claimOneItemStock(item, product, opts) {
  if (product.hasVariants && item.variantId && item.subVariantId) {
    const claimed = await Product.findOneAndUpdate(
      {
        _id: product._id,
        variants: {
          $elemMatch: {
            _id: item.variantId,
            subVariants: {
              $elemMatch: { _id: item.subVariantId, stock: { $gte: item.quantity } },
            },
          },
        },
      },
      { $inc: { "variants.$[v].subVariants.$[sv].stock": -item.quantity } },
      { ...opts, arrayFilters: [{ "v._id": item.variantId }, { "sv._id": item.subVariantId }] },
    );
    return claimed ? "subVariant" : null;
  }

  if (product.hasVariants && item.variantId) {
    const claimed = await Product.findOneAndUpdate(
      { _id: product._id, "variants._id": item.variantId, "variants.stock": { $gte: item.quantity } },
      { $inc: { "variants.$.stock": -item.quantity } },
      opts,
    );
    return claimed ? "variant" : null;
  }

  const claimed = await Product.findOneAndUpdate(
    { _id: product._id, stock: { $gte: item.quantity } },
    { $inc: { stock: -item.quantity } },
    opts,
  );
  return claimed ? "simple" : null;
}

// Inverse of claimOneItemStock, keyed on the same `kind` string it returned.
async function releaseOneItemStock(item, product, kind, opts) {
  if (kind === "subVariant") {
    await Product.updateOne(
      { _id: product._id },
      { $inc: { "variants.$[v].subVariants.$[sv].stock": item.quantity } },
      { ...opts, arrayFilters: [{ "v._id": item.variantId }, { "sv._id": item.subVariantId }] },
    );
  } else if (kind === "variant") {
    await Product.updateOne(
      { _id: product._id, "variants._id": item.variantId },
      { $inc: { "variants.$.stock": item.quantity } },
      opts,
    );
  } else {
    await Product.updateOne({ _id: product._id }, { $inc: { stock: item.quantity } }, opts);
  }
}

// Every branch here claims stock with a single atomic findOneAndUpdate
// (condition + decrement in one round-trip) rather than the previous
// read-in-JS-then-save pattern — two orders racing for the same last unit
// (e.g. one via COD, one via Razorpay, or two webhook retries for two
// different orders) could both read a pre-decrement `stock` value and both
// pass the `stock < quantity` check before either write lands, overselling
// the item. Losing this race throws instead of silently overselling.
//
// Attempts *every* item regardless of an earlier failure — for the
// razorpay/webhook callers (no session, payment already captured), the old
// throw-on-first-failure meant any item *after* the first failure never
// even got its own claim attempted, even if it still had stock. If any item
// ends up failing and there's no transaction to roll the others back
// automatically, this rolls back whatever it itself successfully claimed
// in this same call before throwing — so a partial failure never leaves
// some items decremented and others not with no record of which. (For COD,
// inside a transaction, the transaction abort on throw already discards
// every claim from this call regardless, so the explicit rollback below is
// a no-op there — session is truthy, the `if (!session)` guard skips it.)
export const reduceStock = async (order, session = null) => {
  const opts = session
    ? { session, returnDocument: "after" }
    : { returnDocument: "after" };

  const failures = [];
  const claimed = []; // { item, product, kind } for everything successfully claimed this call

  for (const item of order.items) {
    const product = await Product.findById(item.product)
      .select("type name hasVariants")
      .session(session || null);

    if (!product || product.type !== "physical") {
      continue;
    }

    const kind = await claimOneItemStock(item, product, opts);
    if (!kind) {
      const label =
        product.hasVariants && item.subVariantId
          ? "sub-variant out of stock"
          : product.hasVariants && item.variantId
            ? "variant out of stock"
            : "out of stock";
      failures.push(`${product.name} ${label}`);
      continue;
    }
    claimed.push({ item, product, kind });
  }

  if (failures.length) {
    if (!session) {
      for (const { item, product, kind } of claimed) {
        await releaseOneItemStock(item, product, kind, {});
      }
    }
    throw new ApiError(400, failures.join("; "));
  }
};

// Counterpart to reduceStock, for releasing stock back once a *paid* order
// (COD confirmed, or razorpay past verifyPayment) is cancelled — without
// this, cancelling a paid order permanently lost the claimed
// stock/inventory with no automated way back into sellable stock.
export async function restoreStock(order, session = null) {
  const opts = session ? { session } : {};

  for (const item of order.items) {
    const product = await Product.findById(item.product)
      .select("type hasVariants")
      .session(session || null);

    if (!product || product.type !== "physical") {
      continue;
    }

    const kind =
      product.hasVariants && item.variantId && item.subVariantId
        ? "subVariant"
        : product.hasVariants && item.variantId
          ? "variant"
          : "simple";

    await releaseOneItemStock(item, product, kind, opts);
  }
}

// True once an order has actually reached the point reduceStock runs for it
// — COD claims stock unconditionally inside createOrder's own transaction,
// so any COD order that exists at all has already had stock claimed;
// razorpay only claims it once verifyPayment's atomic payment claim
// succeeds, so "paid"/"refunded"/"partially_refunded" all imply that
// already happened at some point, while "pending"/"failed" mean it never
// did. Used to gate stock/coupon release on cancellation — releasing either
// for an order that never actually claimed them would incorrectly inflate
// stock or under-count a coupon's real usage.
function wasPaymentFinalized(order) {
  return (
    order.payment?.method === "cod" ||
    ["paid", "refunded", "partially_refunded"].includes(order.payment?.status)
  );
}

// Shared by both cancellation entry points (customer cancelOrder, admin
// updateOrderStatus) — everything that needs to happen once an order is
// confirmed cancelled: refund, then (only if payment was actually
// finalized) release the stock and coupon usage it claimed.
async function applyOrderCancellationSideEffects(order) {
  await refundOrderOnCancellation(order);

  if (!wasPaymentFinalized(order)) {
    return;
  }

  try {
    await restoreStock(order);
  } catch (err) {
    console.error(
      { orderId: order._id, err },
      "applyOrderCancellationSideEffects: stock restore failed — needs manual follow-up",
    );
  }

  if (order.coupon?.code) {
    try {
      await releaseCouponUsage(order.coupon.code, order._id);
    } catch (err) {
      console.error(
        { orderId: order._id, err },
        "applyOrderCancellationSideEffects: coupon release failed",
      );
    }
  }
}

// Atomically claims an order for cancellation — blocks if it's already
// delivered/cancelled, if ANY shipment on it has already been delivered
// (an order split across multiple shipments can sit stuck below
// "delivered" indefinitely while one shipment genuinely reached the
// customer — see orderSync.js's deriveOrderStatus, which only promotes
// orderStatus once *every* shipment is delivered), or if any return already
// exists on
// the order (that return's own refund flow already handles its items; a
// full-order cancellation refund on top would either double-refund or, once
// the shared Transaction-aggregate safety cap in processReturnRefund caps
// it to zero, strand the rest of the order with no other path to reach it).
// This is also what closes the double-refund race that plain
// findById-mutate-save cancellation had: only one concurrent caller for the
// same order can ever win this update.
async function claimOrderForCancellation(filter) {
  return Order.findOneAndUpdate(
    {
      ...filter,
      orderStatus: { $nin: ["delivered", "cancelled"] },
      "shipments.status": { $ne: "delivered" },
      returns: { $size: 0 },
    },
    { $set: { orderStatus: "cancelled" } },
    { new: true },
  );
}

// Called when reduceStock fails *after* a razorpay payment has already been
// captured (verifyPayment, or the webhook's equivalent) — previously this
// was just a console.error with nothing else: the customer got a "payment
// verified" success response for an order that couldn't actually claim its
// stock, no refund, no notification, nothing. Cancels and refunds the order
// instead. Deliberately does NOT call restoreStock — reduceStock already
// rolled back anything it itself claimed in that same call (see its own
// self-rollback when called without a session), so there's nothing left to
// release here; calling restoreStock on top would double-credit stock for
// items reduceStock never actually left decremented.
export async function handlePostPaymentStockFailure(order) {
  const claimed = await claimOrderForCancellation({ _id: order._id });
  if (!claimed) {
    // Order moved on some other way in the meantime (shouldn't normally
    // happen this soon after payment) — nothing more to safely do here.
    return;
  }

  await refundOrderOnCancellation(claimed);
  await claimed.save();

  try {
    await cancelShipmentsForOrder(claimed._id);
  } catch (err) {
    console.error({ orderId: claimed._id, err }, "handlePostPaymentStockFailure: shipment cancellation failed");
  }

  try {
    const user = await User.findById(claimed.user).select("firstName email phoneNumber").lean();

    await notificationQueue.add("order-confirmed", {
      orderId: claimed._id.toString(),
      orderStatus: claimed.orderStatus,
      userEmail: user?.email,
      userName: user?.firstName,
      userPhone: user?.phoneNumber,
      subTotal: claimed.subTotal,
      discount: claimed.discount,
      couponCode: claimed.coupon?.code,
      totalAmount: claimed.totalAmount,
      shipping: claimed.shipping,
      tax: claimed.tax,
      currency: claimed.payment?.currency || "INR",
      orderType: claimed.orderType,
      products: claimed.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        type: item.type,
      })),
    });
  } catch (err) {
    console.error({ orderId: claimed._id, err }, "handlePostPaymentStockFailure: notification failed");
  }
}

// Replays a previously-created order's create-order response shape —
// shared by the pre-check (fast path: this attempt already succeeded) and
// the duplicate-key catch (slow path: this request lost a race against a
// concurrent one for the same key) in createOrder below.
function respondWithExistingOrder(res, existing) {
  return res.json(
    new ApiResponse(
      200,
      {
        order: existing,
        paymentRequired: existing.payment?.method === "razorpay" && existing.payment?.status !== "paid",
        razorpayConfig:
          existing.payment?.method === "razorpay" && existing.payment?.razorpayOrderId
            ? {
                key: process.env.RAZORPAY_KEY_ID,
                orderId: existing.payment.razorpayOrderId,
                amount: Math.round(existing.totalAmount * 100),
                currency: existing.payment.currency,
              }
            : null,
      },
      "Order already created for this attempt",
    ),
  );
}

export const createOrder = asyncHandler(async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid input");
  }

  const { addressId, paymentMethod, currency = "INR", idempotencyKey } = parsed.data;

  // A network retry or a double-click/second-tab submit of the same
  // checkout attempt used to just create a second order off the same
  // cart — there was nothing tying a create-order request back to "this is
  // the same attempt as that one." The client sends one key per attempt
  // (see usePaymentStore.js); a matching existing order means this exact
  // attempt already succeeded, so its response is replayed instead of
  // creating a duplicate. The unique (user, idempotencyKey) index is the
  // real backstop for two concurrent requests racing each other — this
  // lookup alone would still have a TOCTOU gap between the two.
  if (idempotencyKey) {
    const existing = await Order.findOne({ user: req.user._id, idempotencyKey });
    if (existing) {
      return respondWithExistingOrder(res, existing);
    }
  }

  // Resolved BEFORE the transaction below opens — this may call out to
  // Shiprocket's serviceability API (see resolveSelfShippingCost), and an
  // external HTTP round-trip has no business holding a Mongo transaction
  // open. The cart/address read here is a plain pre-check; the in-transaction
  // read further down stays authoritative for the actual order creation.
  const preCart = await Cart.findOne({ user: req.user._id });

  if (!preCart || !preCart.items.length) {
    throw new ApiError(400, "Cart is empty");
  }

  const preAddressDoc = addressId
    ? await Address.findOne({ _id: addressId, user: req.user._id })
    : null;

  if (addressId && !preAddressDoc) {
    throw new ApiError(404, "Address not found");
  }

  // COD is only ever a physical-delivery payment method — a digital item
  // has no delivery event to collect cash at, and createOrder already
  // marks a COD order "confirmed"/downloads-unlocked immediately (see
  // below), so a digital-containing cart on COD would hand over the
  // download without any payment ever happening. Mirrors the same
  // `codEnabled` setting getCheckoutInfo exposes to the frontend — checked
  // again here since that endpoint only hides the option in the UI, it
  // doesn't stop a direct API call.
  if (paymentMethod === "cod") {
    const [codSettings, cartProducts] = await Promise.all([
      Setting.findOne().select("payment.codEnabled").lean(),
      Product.find(
        { _id: { $in: preCart.items.map((item) => item.product) } },
        { _id: 1, type: 1 },
      ),
    ]);

    if (!(codSettings?.payment?.codEnabled ?? true)) {
      throw new ApiError(400, "Cash on Delivery is currently unavailable");
    }

    const productTypeMap = new Map(cartProducts.map((p) => [String(p._id), p.type]));
    const hasDigitalProduct = preCart.items.some(
      (item) => productTypeMap.get(String(item.product)) === "digital",
    );

    if (hasDigitalProduct) {
      throw new ApiError(
        400,
        "Cash on Delivery isn't available for digital products — please choose Pay Online.",
      );
    }
  }

  const shippingQuote = await resolveSelfShippingCost({
    items: preCart.items,
    deliveryPincode: preAddressDoc?.pincode || null,
    cod: paymentMethod === "cod" ? 1 : 0,
  });

  // A real destination was checked and nothing can ship there — this is a
  // fact about the address, not a transient failure, so unlike every other
  // resolveSelfShippingCost fallback branch it must never silently fall
  // back to the flat rate and let the order through.
  if (shippingQuote.source === "unserviceable") {
    throw new ApiError(
      400,
      "We can't ship physical items to this address yet — please choose a different delivery address.",
    );
  }

  const session = await mongoose.startSession();

  session.startTransaction();

  try {
    // Reuse `preCart` (already loaded above, and what shippingQuote was
    // computed from) rather than re-reading the cart a second time here —
    // two separate reads left a real window between them for the cart to
    // change (e.g. a quantity edit from another tab landing in between),
    // which would price the order against the NEW quantity while still
    // charging shipping quoted for the OLD one. Binding the same document
    // to this transaction's session (rather than loading a fresh one)
    // keeps pricing and the cart-clearing write below working off one
    // consistent snapshot.
    const cart = preCart;
    cart.$session(session);

    if (!cart || !cart.items.length) {
      throw new ApiError(400, "Cart is empty");
    }

    // Every item is re-priced live (never trusting the cart's own snapshot)
    // right before checkout math runs, so subTotal/tax/totalAmount below —
    // and thus the amount actually charged — reflect current pricing, not
    // whatever price happened to be on the cart from whenever the item was
    // added. Each product/variant is only fetched once here and cached in
    // productResolutions, reused by the formattedItems loop below instead
    // of re-fetching — guarantees the exact same document backs both the
    // cart-level totals and the order's own line items, not just two
    // separately-fetched reads that usually happen to agree.
    const productResolutions = new Map();

    for (let idx = 0; idx < cart.items.length; idx++) {
      const item = cart.items[idx];

      const product = await Product.findById(item.product).session(session);
      if (!product) throw new ApiError(404, "Product not found");

      if (product.soldByRatti) {
        if (
          !isValidRatti(
            item.selectedRatti,
            product.minRatti,
            product.maxRatti,
            product.outOfStockRattis,
          )
        ) {
          throw new ApiError(400, `${product.name}: invalid or out-of-stock ratti selected`);
        }
        item.price = Math.round(product.price * item.selectedRatti * 100) / 100;
        item.mrp = Math.round(product.mrp * item.selectedRatti * 100) / 100;
      } else if (product.hasVariants && item.variantId) {
        const variant = product.variants.id(item.variantId);
        if (!variant) throw new ApiError(404, "Variant not found");

        if (variant.subVariants?.length > 0) {
          const subVariant = item.subVariantId ? variant.subVariants.id(item.subVariantId) : null;
          if (!subVariant) throw new ApiError(400, "Sub-variant not found");
          item.price = subVariant.price;
          item.mrp = subVariant.mrp;
        } else {
          item.price = variant.price;
          item.mrp = variant.mrp;
        }
      } else {
        item.price = product.price;
        item.mrp = product.mrp;
      }

      // Re-resolve the selected certificate's price live from the product,
      // same "never trust the cart snapshot" treatment as variant/ratti
      // pricing above — an admin may have changed its price (or removed it)
      // since it was added to the cart.
      if (item.certificateId) {
        const certificate = product.certificates?.id(item.certificateId);
        if (!certificate) throw new ApiError(400, `${product.name}: selected certificate no longer available`);
        item.certificateName = certificate.name;
        item.certificateIncludedInPrice = certificate.includedInPrice;
        item.certificatePrice = certificate.includedInPrice ? 0 : (certificate.price || 0);
      }

      productResolutions.set(idx, { product });
    }

    await calculateCart(cart, req.user._id, { selfShippingCost: shippingQuote.amount });

    const subTotal = cart.subTotal || 0;
    const discount = cart.discount || 0;
    const shipping = cart.shipping || 0;
    const selfShippingAmount = cart.selfShippingAmount || 0;
    const tax = cart.tax || 0;
    const totalAmount = cart.totalAmount || 0;

    const selectedCurrency = currency.toUpperCase();

    const supportedCurrencies = [
      "INR",
      "USD",
      "EUR",
      "GBP",
      "AED",
      "AUD",
      "CAD",
      "SGD",
      "JPY",
    ];

    if (!supportedCurrencies.includes(selectedCurrency)) {
      throw new ApiError(400, "Unsupported currency");
    }

    // getRateFor throws on a missing/invalid rate rather than returning 0 —
    // deliberately not caught/defaulted here (the old `|| 1` used to turn
    // that into a silent 1:1 INR rate for a foreign-currency order); this
    // is inside the open transaction, so a failed rate lookup now aborts
    // order creation cleanly instead of mispricing it.
    const safeRate = await getRateFor(selectedCurrency);

    const convertedSubTotal = Number((subTotal * safeRate).toFixed(2));

    const convertedShipping = Number((shipping * safeRate).toFixed(2));
    const convertedSelfShippingAmount = Number((selfShippingAmount * safeRate).toFixed(2));

    const convertedTax = Number((tax * safeRate).toFixed(2));

    const convertedDiscount = Number((discount * safeRate).toFixed(2));

    const convertedAmount = Number((totalAmount * safeRate).toFixed(2));

    if (convertedAmount == null || Number.isNaN(convertedAmount) || convertedAmount < 0) {
      throw new ApiError(400, "Currency amount not found");
    }

    let hasPhysicalProduct = false;

    const formattedItems = [];

    for (let idx = 0; idx < cart.items.length; idx++) {
      const item = cart.items[idx];
      const resolution = productResolutions.get(idx);
      const product = resolution?.product;

      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      // A product can sit in a cart for a long time — if the admin
      // unpublishes it in the meantime, addToCart's own isPublished check
      // never runs again for that existing line, so this is the last real
      // gate before an order (and a stock deduction) gets created for it.
      if (!product.isPublished) {
        throw new ApiError(400, `${product.name} is no longer available`);
      }

      // item.price/item.mrp were just live-refreshed above for every item via
      // the product/variant/sub-variant lookup this loop used to redo here —
      // never product.price, which for a variant/sub-variant product would
      // be the wrong (parent-level) price entirely. Converted to the order's
      // selected currency here, same as taxAmount below and the order-level
      // subTotal/shipping/tax/totalAmount — these used to stay in raw INR
      // while everything else on the order converted, so for any non-INR
      // order `item.price` silently disagreed with the order totals it's
      // supposed to sum into, and refund math that added a raw INR price to
      // a converted tax amount was refunding a meaningless mixed-scale
      // number.
      let price = Number((item.price * safeRate).toFixed(2));

      let mrp = Number((item.mrp * safeRate).toFixed(2));

      let stock = product.stock;

      let image = product.thumbnail || product.images?.[0];

      let variantName = null;
      let variantValue = null;
      let subVariantName = null;
      let subVariantValue = null;

      if (product.hasVariants && item.variantId) {
        const variant = product.variants.id(item.variantId);

        if (!variant) {
          throw new ApiError(404, "Variant not found");
        }

        variantName = variant.name;
        variantValue = variant.value;

        if (variant.subVariants?.length > 0) {
          const subVariant = item.subVariantId ? variant.subVariants.id(item.subVariantId) : null;

          if (!subVariant) {
            throw new ApiError(400, "Sub-variant not found");
          }

          // price/mrp already set above from item.price/item.mrp, refreshed
          // from this exact sub-variant by the productResolutions loop —
          // not recomputed here to avoid two places deriving the same
          // number that could silently drift apart later.
          stock = subVariant.stock;
          subVariantName = subVariant.name;
          subVariantValue = subVariant.value;
        } else {
          stock = variant.stock;
        }
      }

      if (product.type === "physical") {
        hasPhysicalProduct = true;

        if (stock < item.quantity) {
          throw new ApiError(400, `${product.name} out of stock`);
        }
      }

      formattedItems.push({
        product: product._id,
        variantId: item.variantId || null,
        subVariantId: item.subVariantId || null,
        variantName,
        variantValue,
        subVariantName,
        subVariantValue,
        selectedRatti: item.selectedRatti || null,
        certificateId: item.certificateId || null,
        certificateName: item.certificateName || null,
        certificatePrice: Number(((item.certificatePrice || 0) * safeRate).toFixed(2)),
        certificateIncludedInPrice: item.certificateIncludedInPrice || false,
        name: product.name,
        type: product.type,
        price,
        mrp,
        quantity: item.quantity,
        image,
        taxRate: item.taxRate || 0,
        taxType: item.taxType || "exclusive",
        taxAmount: Number(((item.taxAmount || 0) * safeRate).toFixed(2)),
        source: item.source || "internal",
      });
    }

    // Already loaded (and validated to exist) in the pre-transaction quote
    // lookup above — no need to re-query it here.
    let addressDoc = null;

    let shippingAddress = null;

    if (hasPhysicalProduct && addressId) {
      addressDoc = preAddressDoc;

      shippingAddress = {
        fullName: addressDoc.fullName,
        phone: addressDoc.phone,
        pincode: addressDoc.pincode,
        state: addressDoc.state,
        city: addressDoc.city,
        addressLine1: addressDoc.addressLine1,
        addressLine2: addressDoc.addressLine2,
        landmark: addressDoc.landmark,
      };
    }

    const order = await Order.create(
      [
        {
          user: req.user._id,

          idempotencyKey: idempotencyKey || null,

          items: formattedItems,

          orderType: hasPhysicalProduct ? "physical" : "digital",

          addressId: addressDoc?._id || null,

          shippingAddress,

          subTotal: convertedSubTotal,

          discount: convertedDiscount,

          shipping: convertedShipping,
          selfShippingAmount: convertedSelfShippingAmount,

          shippingQuote: {
            source: shippingQuote.source,
            courierId: shippingQuote.courierId || null,
            courierName: shippingQuote.courierName || null,
            etd: shippingQuote.etd || null,
            weightKg: shippingQuote.weightKg ?? null,
            amount: shippingQuote.amount,
          },

          tax: convertedTax,

          totalAmount: convertedAmount,

          baseAmount: totalAmount,

          baseCurrency: "INR",

          exchangeRate: safeRate,

          coupon: cart.appliedCoupon
            ? {
                code: cart.appliedCoupon,
                discountAmount: convertedDiscount,
              }
            : null,

          payment: {
            method: paymentMethod,
            currency: selectedCurrency,
            // COD used to be marked "paid" the instant the order was placed,
            // before the courier ever collected any cash — a cancelled COD
            // order (cancelOrder never touches payment.status) stayed
            // permanently "paid" for money that was never received, and
            // dashboard revenue counted it as collected immediately. COD now
            // starts "pending" like everything else and only flips to "paid"
            // when the order's shipment(s) actually reach "delivered" — see
            // deriveOrderStatus/syncShipmentSummary in orderSync.js.
            status: "pending",
          },

          orderStatus:
            paymentMethod === "cod" ? "confirmed" : "payment_pending",
        },
      ],
      { session },
    );

    await Transaction.create(
      [
        {
          user: req.user._id,

          order: order[0]._id,

          amount: convertedAmount,

          transactionType: "order",

          currency: selectedCurrency,

          baseCurrency: "INR",

          baseAmount: totalAmount,

          subTotal: convertedSubTotal,

          shipping: convertedShipping,

          tax: convertedTax,

          taxInclusive: false,

          discount: convertedDiscount,

          exchangeRate: safeRate,

          method: paymentMethod,

          // Mirrors payment.status above — flips to "success" only once
          // syncShipmentSummary sees the order actually delivered.
          status: "pending",
        },
      ],
      { session },
    );

    let razorpayConfig = null;

    if (paymentMethod === "razorpay") {
      const rzpOrder = await createRazorpayOrder({
        amount: convertedAmount,
        currency: selectedCurrency,
        receipt: order[0]._id.toString(),
      });

      order[0].payment.razorpayOrderId = rzpOrder.id;

      await order[0].save({
        session,
      });

      await Transaction.findOneAndUpdate(
        {
          order: order[0]._id,
        },
        {
          $set: {
            razorpayOrderId: rzpOrder.id,
          },
        },
        { session },
      );

      razorpayConfig = {
        key: process.env.RAZORPAY_KEY_ID,
        orderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
      };
    }

    if (paymentMethod === "cod") {
      await reduceStock(order[0], session);

      if (order[0].coupon?.code) {
        const claimed = await claimCouponUsage(order[0].coupon.code, req.user._id, session, order[0]._id);
        if (!claimed) {
          logger.warn(
            `[order] coupon "${order[0].coupon.code}" usage limit reached before order ${order[0]._id} could claim it — order still proceeds, discount already applied`,
          );
        }
      }

      cart.items = [];
      cart.subTotal = 0;
      cart.discount = 0;
      cart.shipping = 0;
      cart.tax = 0;
      cart.totalAmount = 0;
      cart.couponCode = null;
      cart.appliedCoupon = null;

      await cart.save({
        session,
      });
    }

    await session.commitTransaction();

    session.endSession();

    // COD orders are confirmed immediately (no separate verify-payment step
    // like razorpay has) so the same post-commit best-effort side effects
    // verifyPayment runs for razorpay — digital delivery + shipment
    // creation — need to run here too, or a COD order would never get
    // either. Each isolated so one failure doesn't block order creation.
    if (paymentMethod === "cod") {
      try {
        await createDownloadsFromOrder(order[0]._id);
      } catch (err) {
        console.error({ orderId: order[0]._id, err }, "createOrder: download creation failed");
      }

      try {
        await processFulfillment(order[0]._id);
      } catch (err) {
        console.error({ orderId: order[0]._id, err }, "createOrder: fulfillment processing failed");
      }

      try {
        const user = await User.findById(order[0].user).select("firstName email phoneNumber").lean();

        await notificationQueue.add("order-confirmed", {
          orderId: order[0]._id.toString(),
          orderStatus: order[0].orderStatus,
          userEmail: user?.email,
          userName: user?.firstName,
          userPhone: user?.phoneNumber,
          subTotal: order[0].subTotal,
          discount: order[0].discount,
          couponCode: order[0].coupon?.code,
          totalAmount: order[0].totalAmount,
          shipping: order[0].shipping,
          tax: order[0].tax,
          currency: order[0].payment?.currency || "INR",
          orderType: order[0].orderType,
          products: order[0].items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            type: item.type,
          })),
        });
      } catch (err) {
        console.error({ orderId: order[0]._id, err }, "createOrder: notification enqueue failed");
      }
    }

    return res.json(
      new ApiResponse(
        200,
        {
          order: order[0],
          paymentRequired: paymentMethod === "razorpay",
          razorpayConfig,
        },
        "Order created successfully",
      ),
    );
  } catch (err) {
    await session.abortTransaction();

    session.endSession();

    // Two concurrent requests for the same attempt can both pass the
    // pre-check above and race into Order.create — the unique
    // (user, idempotencyKey) index is what actually prevents the duplicate,
    // and it does so by throwing here on whichever request loses the race.
    // That's a legitimate "already handled" outcome, not a real failure —
    // replay the winner's order instead of surfacing a raw 500.
    if (idempotencyKey && err?.code === 11000) {
      const existing = await Order.findOne({ user: req.user._id, idempotencyKey });
      if (existing) {
        return respondWithExistingOrder(res, existing);
      }
    }

    throw err;
  }
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const parsed = verifyPaymentSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid input");
  }

  const {
    orderId,
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
  } = parsed.data;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid order id");
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw new ApiError(400, "Invalid payment signature");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  let claimedOrder = null;

  try {
    // Atomic claim — only one of client or webhook wins; the other gets null
    claimedOrder = await Order.findOneAndUpdate(
      { _id: orderId, "payment.status": { $ne: "paid" } },
      {
        $set: {
          "payment.status": "paid",
          "payment.transactionId": razorpay_payment_id,
          "payment.razorpayOrderId": razorpay_order_id,
          orderStatus: "placed",
        },
      },
      { returnDocument: "after", session },
    );

    await Transaction.findOneAndUpdate(
      { order: orderId },
      {
        $set: {
          status: "success",
          transactionId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
        },
      },
      { session },
    );

    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }

  if (!claimedOrder) {
    // Webhook already processed this payment — return success without re-running side effects
    console.info(
      { orderId },
      "verifyPayment: webhook already claimed, skipping post-processing",
    );
    const alreadyPaid = await Order.findById(orderId).lean();
    return res.json(
      new ApiResponse(200, alreadyPaid, "Payment already verified"),
    );
  }

  // Post-commit side effects — best effort, each isolated so one failure doesn't block others
  let stockClaimFailed = false;
  try {
    await reduceStock(claimedOrder);
  } catch (err) {
    stockClaimFailed = true;
    console.error(
      { orderId, err },
      "verifyPayment: stock reduction failed after payment capture — cancelling and refunding order",
    );
    try {
      await handlePostPaymentStockFailure(claimedOrder);
    } catch (cancelErr) {
      console.error(
        { orderId, err: cancelErr },
        "verifyPayment: failed to auto-cancel/refund after stock claim failure — needs manual follow-up",
      );
    }
  }

  // Order is being cancelled/refunded above — no point claiming a coupon
  // use (or unlocking downloads/fulfillment below) for an order that isn't
  // going to be fulfilled.
  if (!stockClaimFailed && claimedOrder.coupon?.code) {
    try {
      const claimed = await claimCouponUsage(claimedOrder.coupon.code, claimedOrder.user, null, claimedOrder._id);
      if (!claimed) {
        logger.warn(
          `[order] coupon "${claimedOrder.coupon.code}" usage limit reached before order ${orderId} could claim it — order still proceeds, discount already applied`,
        );
      }
    } catch (err) {
      console.error({ orderId, err }, "verifyPayment: coupon update failed");
    }
  }

  try {
    await Cart.findOneAndUpdate(
      { user: claimedOrder.user },
      {
        $set: {
          items: [],
          subTotal: 0,
          discount: 0,
          shipping: 0,
          tax: 0,
          totalAmount: 0,
          couponCode: null,
          appliedCoupon: null,
        },
      },
    );
  } catch (err) {
    console.error({ orderId, err }, "verifyPayment: cart clearing failed");
  }

  // handlePostPaymentStockFailure above already cancelled/refunded/notified
  // for this order — unlocking downloads or creating shipments for
  // something that just got cancelled would hand over what was just
  // refunded, and a second "order-confirmed" notification job below would
  // race the cancellation one it already sent with stale (pre-cancellation)
  // status/coupon data from this same `claimedOrder` reference.
  if (stockClaimFailed) {
    return res.json(
      new ApiResponse(200, claimedOrder, "Payment verified"),
    );
  }

  try {
    await createDownloadsFromOrder(claimedOrder._id);

    if (claimedOrder.orderType === "digital") {
      await Order.findByIdAndUpdate(claimedOrder._id, {
        $set: { orderStatus: "delivered" },
      });
      claimedOrder.orderStatus = "delivered";
    }
  } catch (err) {
    console.error({ orderId, err }, "verifyPayment: download creation failed");
  }

  try {
    await processFulfillment(claimedOrder._id);
  } catch (err) {
    console.error({ orderId, err }, "verifyPayment: fulfillment processing failed");
  }

  try {
    const user = await User.findById(claimedOrder.user)
      .select("firstName email phoneNumber")
      .lean();

    await notificationQueue.add("order-confirmed", {
      orderId: claimedOrder._id.toString(),
      orderStatus: claimedOrder.orderStatus,
      userEmail: user?.email,
      userName: user?.firstName,
      userPhone: user?.phoneNumber,
      subTotal: claimedOrder.subTotal,
      discount: claimedOrder.discount,
      couponCode: claimedOrder.coupon?.code,
      totalAmount: claimedOrder.totalAmount,
      shipping: claimedOrder.shipping,
      tax: claimedOrder.tax,
      currency: claimedOrder.payment?.currency || "INR",
      orderType: claimedOrder.orderType,
      products: claimedOrder.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        type: item.type,
      })),
    });
  } catch (err) {
    console.error({ orderId, err }, "verifyPayment: notification failed");
  }

  return res.json(
    new ApiResponse(200, claimedOrder, "Payment verified successfully"),
  );
});

export const getMyOrders = asyncHandler(async (req, res) => {
  // "payment_pending" is set the moment checkout starts, before Razorpay
  // payment actually completes — if the customer abandons or never finishes
  // paying, that order would otherwise sit in their history looking like a
  // real order until the cleanup cron deletes it (or forever, if it's never
  // that old). Excluded here rather than at the cron's cutoff so an
  // in-progress checkout doesn't show up as an "order" even for the couple
  // of minutes before it either completes or gets abandoned.
  const orders = await Order.find({
    user: req.user._id,
    orderStatus: { $ne: "payment_pending" },
  }).sort({ createdAt: -1 });

  return res.json(new ApiResponse(200, orders, "Orders fetched successfully"));
});

export const getOrderDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid order id");
  }

  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id,
  }).populate("items.product");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Live admin preference (Setting.shipping.displayMode), not snapshotted
  // on the order — lets past orders render selfShippingAmount as one
  // merged line or a separate one, matching whatever the admin currently
  // has configured.
  const settings = await Setting.findOne().select("shipping.displayMode").lean();
  const orderObj = order.toObject();
  orderObj.shippingDisplayMode = settings?.shipping?.displayMode || "merged";

  // order.payment.status alone tells the customer a refund happened, but
  // not how much or when — pulling the actual refund Transaction record(s)
  // here so the order detail page can show a real amount instead of just a
  // "Refunded" label with no figure behind it.
  if (["refunded", "partially_refunded"].includes(order.payment?.status)) {
    orderObj.refundTransactions = await Transaction.find({
      order: order._id,
      transactionType: "refund",
      status: "success",
    })
      .select("amount currency method razorpayRefundId createdAt")
      .sort({ createdAt: 1 })
      .lean();
  }

  return res.json(new ApiResponse(200, orderObj, "Order fetched successfully"));
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id,
  });

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.orderStatus === "delivered") {
    throw new ApiError(400, "Delivered order cannot be cancelled");
  }
  if (order.orderStatus === "cancelled") {
    throw new ApiError(400, "Order is already cancelled");
  }
  // An order split across multiple shipments can sit below "delivered"
  // indefinitely even after one shipment genuinely reached the customer
  // (deriveOrderStatus, orderSync.js, only promotes orderStatus once
  // *every* shipment is delivered) — check per-shipment state directly
  // instead of trusting the aggregate status alone.
  if (order.shipments?.some((s) => s.status === "delivered")) {
    throw new ApiError(
      400,
      "Part of this order has already been delivered — request a return for those items instead",
    );
  }
  if (order.returns?.length > 0) {
    throw new ApiError(
      400,
      "This order already has a return in progress — further changes must go through the return flow",
    );
  }

  const cancellationWindowHours = await getCancellationWindowHours();
  if (cancellationWindowHours > 0) {
    const cutoff = new Date(
      order.createdAt.getTime() + cancellationWindowHours * 60 * 60 * 1000,
    );

    if (new Date() > cutoff) {
      throw new ApiError(
        400,
        `Cancellation window (${cancellationWindowHours} hours from order placement) has expired`,
      );
    }
  }

  // The above checks are for a clear error message in the common case — this
  // atomic claim is the actual race-safe enforcement (see its own comment).
  const claimed = await claimOrderForCancellation({ _id: orderId, user: req.user._id });
  if (!claimed) {
    throw new ApiError(400, "This order can no longer be cancelled");
  }

  await applyOrderCancellationSideEffects(claimed);
  await claimed.save();

  try {
    await cancelShipmentsForOrder(claimed._id);
  } catch (err) {
    console.error({ orderId, err }, "cancelOrder: shipment cancellation failed");
  }

  try {
    const user = await User.findById(claimed.user)
      .select("firstName email phoneNumber")
      .lean();

    await notificationQueue.add("order-confirmed", {
      orderId: claimed._id.toString(),
      orderStatus: claimed.orderStatus,
      userEmail: user?.email,
      userName: user?.firstName,
      userPhone: user?.phoneNumber,
      subTotal: claimed.subTotal,
      discount: claimed.discount,
      couponCode: claimed.coupon?.code,
      totalAmount: claimed.totalAmount,
      shipping: claimed.shipping,
      tax: claimed.tax,
      currency: claimed.payment?.currency || "INR",
      orderType: claimed.orderType,
      products: claimed.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        type: item.type,
      })),
    });
  } catch (err) {
    console.error({ orderId, err }, "cancelOrder: notification failed");
  }

  return res.json(new ApiResponse(200, claimed, "Order cancelled successfully"));
});

export const downloadInvoice = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id,
    });

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    await ensureSequenceNumber(Order, order, {
      field: "invoiceNumber",
      counterKey: "invoice",
      formatter: formatInvoiceNumber,
    });

    const html = generateInvoiceTemplate(order);

    const browser = await puppeteer.connect({
      browserWSEndpoint: process.env.PDF_SERVER,
    });

    let pdfBuffer;

    try {
      const page = await browser.newPage();

      await page.setContent(html, { waitUntil: "networkidle0" });

      pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
      });
    } finally {
      await browser.close();
    }

    if (!pdfBuffer || pdfBuffer.length < 1000) {
      throw new Error("PDF generation failed");
    }

    res.setHeader("Content-Type", "application/pdf");
    // Never let the browser reuse a cached response for this URL — the
    // invoice number (or anything else about the order) can change between
    // two downloads of the "same" invoice, e.g. right after the sequential
    // invoiceNumber backfill.
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${orderId}.pdf`,
    );

    return res.end(pdfBuffer);
  } catch (error) {
    throw error;
  }
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = req.query.search || "";
  const status = req.query.status || "";
  const { fromDate, toDate, productId, orderType, userId } = req.query;

  const skip = (page - 1) * limit;

  const query = {};

  if (status) {
    query.orderStatus = status;
  }

  if (productId) {
    query["items.product"] = productId;
  }

  // Exact-match customer filter — the fuzzy name/phone `search` below can
  // match more than one person or miss a customer entirely (e.g. renamed
  // since the order was placed); the admin customer detail page needs this
  // one customer's orders specifically, not a name-based guess.
  if (userId) {
    query.user = userId;
  }

  if (orderType === "physical" || orderType === "digital") {
    query.orderType = orderType;
  }

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  if (search) {
    const matchedUsers = await User.find({
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ],
    }).select("_id");

    const orderIdSearch = search.replace(/^#/, "").trim();

    query.$or = [
      { user: { $in: matchedUsers.map((u) => u._id) } },
      { "shippingAddress.phone": { $regex: search, $options: "i" } },
      { "items.name": { $regex: search, $options: "i" } },
      ...(orderIdSearch
        ? [{ $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: orderIdSearch, options: "i" } } }]
        : []),
    ];
  }

  const totalOrders = await Order.countDocuments(query);

  const orders = await Order.find(query)
    .populate("user", "firstName lastName email phoneNumber")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return res.json(
    new ApiResponse(
      200,
      {
        orders,
        pagination: {
          totalOrders,
          currentPage: page,
          totalPages: Math.ceil(totalOrders / limit),
          limit,
        },
      },
      "All orders fetched successfully",
    ),
  );
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { orderStatus } = req.body;

  // Must stay in lockstep with both the Order model's `orderStatus` enum
  // (order.model.js) and the admin's ALL_STATUS_OPTIONS (Orderdetail.jsx) —
  // this used to list "pending", which isn't a valid enum value at all (the
  // model uses "payment_pending" for that state), while omitting "placed",
  // which the admin dropdown actually offers. Selecting "placed" in the UI
  // was silently rejected by this allow-list before it ever reached the
  // model's own validation.
  const allowedStatus = [
    "placed",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];

  if (!allowedStatus.includes(orderStatus)) {
    throw new ApiError(400, "Invalid order status");
  }

  let order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const previousStatus = order.orderStatus;

  // "delivered"/"cancelled" are terminal on the customer-facing side
  // (cancelOrder already blocks cancelling a delivered order) — mirror that
  // here so the admin panel can't force an order back out of a terminal
  // state (e.g. "delivered" -> "processing", or un-cancelling), which would
  // desync already-fired notifications, shipment cancellation, and any
  // return/refund flow keyed off that terminal status.
  const TERMINAL_STATUSES = ["delivered", "cancelled"];
  if (TERMINAL_STATUSES.includes(previousStatus) && orderStatus !== previousStatus) {
    throw new ApiError(
      400,
      `Order is already ${previousStatus} and cannot be changed to ${orderStatus}`,
    );
  }

  if (orderStatus === "cancelled") {
    // Same reasoning as cancelOrder's identical checks — a mixed order's
    // orderStatus can sit below "delivered" indefinitely while one leg
    // genuinely reached the customer, and a return already in progress
    // needs to go through its own refund flow, not a full-order one on top.
    if (order.shipments?.some((s) => s.status === "delivered")) {
      throw new ApiError(
        400,
        "Part of this order has already been delivered — process a return for those items instead",
      );
    }
    if (order.returns?.length > 0) {
      throw new ApiError(
        400,
        "This order already has a return in progress — further changes must go through the return flow",
      );
    }

    // The above checks are for a clear error message — this atomic claim
    // is the actual race-safe enforcement (see claimOrderForCancellation).
    const claimed = await claimOrderForCancellation({ _id: orderId });
    if (!claimed) {
      throw new ApiError(400, "This order can no longer be cancelled");
    }
    order = claimed;

    await applyOrderCancellationSideEffects(order);
  } else {
    order.orderStatus = orderStatus;

    // This bypasses shipment-tracking entirely (an admin can mark an order
    // "delivered" straight from the dropdown), so it's the other place
    // besides syncShipmentSummary that needs to finalize a COD order's
    // payment — otherwise a COD order delivered this way would stay
    // "pending" forever.
    if (orderStatus === "delivered") {
      await finalizeCodPayment(order);
    }

    // Push this manual status forward onto the order's own shipments too
    // (see syncShipmentsToOrderStatus) — otherwise a manually-set
    // "delivered" order leaves its Shipment documents stuck at whatever
    // Shiprocket last reported, which silently blocks return requests
    // (requestReturn requires shipment.status === "delivered").
    await syncShipmentsToOrderStatus(order, orderStatus);
  }

  await order.save();

  await logActivity({
    admin: req.user,
    action: "order.status_update",
    targetType: "Order",
    targetId: order._id,
    targetLabel: `#${String(order._id).slice(-8).toUpperCase()}`,
    changes: diffFields({ orderStatus: previousStatus }, { orderStatus: order.orderStatus }, ["orderStatus"]),
    skipIfNoChanges: true,
  });

  if (orderStatus === "cancelled") {
    try {
      await cancelShipmentsForOrder(order._id);
    } catch (err) {
      console.error({ orderId, err }, "updateOrderStatus: shipment cancellation failed");
    }
  }

  try {
    const user = await User.findById(order.user)
      .select("firstName email phoneNumber")
      .lean();

    await notificationQueue.add("order-confirmed", {
      orderId: order._id.toString(),
      orderStatus: order.orderStatus,
      userEmail: user?.email,
      userName: user?.firstName,
      userPhone: user?.phoneNumber,
      subTotal: order.subTotal,
      discount: order.discount,
      couponCode: order.coupon?.code,
      totalAmount: order.totalAmount,
      shipping: order.shipping,
      tax: order.tax,
      currency: order.payment?.currency || "INR",
      orderType: order.orderType,
      products: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        type: item.type,
      })),
    });
  } catch (err) {
    console.error({ orderId, err }, "verifyPayment: notification failed");
  }

  return res.json(
    new ApiResponse(200, order, "Order status updated successfully"),
  );
});

export const getAdminOrderDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId)
    .populate("user", "name email phone")
    .populate("items.product", "name price images");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Live admin preference — see the matching comment in getOrderDetails.
  const settings = await Setting.findOne().select("shipping.displayMode").lean();
  const orderObj = order.toObject();
  orderObj.shippingDisplayMode = settings?.shipping?.displayMode || "merged";

  return res.json(
    new ApiResponse(200, orderObj, "Order details fetched successfully"),
  );
});

export const getOrderReports = asyncHandler(async (req, res) => {
  const totalOrders = await Order.countDocuments();

  const totalSalesData = await Order.aggregate([
    { $match: { "payment.status": "paid" } },
    { $group: { _id: null, totalSales: { $sum: "$totalAmount" } } },
  ]);

  const statusWiseOrders = await Order.aggregate([
    { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
  ]);

  const paymentMethodBreakdown = await Order.aggregate([
    { $group: { _id: "$payment.method", count: { $sum: 1 } } },
  ]);

  const paymentStatusBreakdown = await Order.aggregate([
    { $group: { _id: "$payment.status", count: { $sum: 1 } } },
  ]);

  const orderTypeBreakdown = await Order.aggregate([
    { $group: { _id: "$orderType", count: { $sum: 1 } } },
  ]);

  const avgOrderValue = await Order.aggregate([
    { $match: { "payment.status": "paid" } },
    { $group: { _id: null, avg: { $avg: "$totalAmount" } } },
  ]);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const dailyRevenue = await Order.aggregate([
    {
      $match: {
        "payment.status": "paid",
        createdAt: { $gte: sevenDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        revenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const monthlyRevenue = await Order.aggregate([
    {
      $match: {
        "payment.status": "paid",
        createdAt: { $gte: sixMonthsAgo },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$createdAt" },
        },
        revenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // 10. Recent orders (last 5)
  const recentOrders = await Order.find()
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .limit(5);

  return res.json(
    new ApiResponse(
      200,
      {
        totalOrders,
        totalSales: totalSalesData[0]?.totalSales || 0,
        avgOrderValue: Math.round(avgOrderValue[0]?.avg || 0),
        statusWiseOrders,
        paymentMethodBreakdown,
        paymentStatusBreakdown,
        orderTypeBreakdown,
        dailyRevenue,
        monthlyRevenue,
        recentOrders,
      },
      "Order reports fetched successfully",
    ),
  );
});
