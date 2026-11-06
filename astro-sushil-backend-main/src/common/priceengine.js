import { Coupon } from "../modules/coupon/coupon.model.js";
import { Product } from "../modules/products/product.modal.js";
import { computeGst } from "./taxEngine.js";
import { FLAT_SELF_SHIPPING_FALLBACK } from "../modules/Fulfillment/shippingQuote.service.js";

export const calculateCart = async (cart, userId = null, { selfShippingCost = null } = {}) => {
  let subTotal = 0;

  cart.items.forEach((item) => {
    // certificatePrice is the resolved extra charge for the selected
    // certificate (0 when includedInPrice) — additive on top of the base
    // item price, not folded into it, so it stays separately displayable
    // (see cart.modal.js).
    item.total = (item.price + (item.certificatePrice || 0)) * item.quantity;
    subTotal += item.total;
  });

  const productIds = cart.items.map((item) => item.product);
  const products = await Product.find({
    _id: { $in: productIds },
  }).select("type gst source");

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  // `selfShippingCost` is a real Shiprocket-quoted rate resolved by the
  // caller (shippingQuote.service.js's resolveSelfShippingCost) once a
  // delivery pincode is known — cart mutations with no address yet just get
  // the flat estimate. Never resolved *inside* this function: that would
  // put an external HTTP call inside every withCartRetry attempt and inside
  // createOrder's open Mongo transaction (see order.controller.js).
  const hasSelfFulfilledPhysical = products.some((p) => p.type === "physical");
  const selfShipping = hasSelfFulfilledPhysical
    ? (selfShippingCost ?? FLAT_SELF_SHIPPING_FALLBACK)
    : 0;
  const shipping = selfShipping;

  let discount = 0;
  let appliedCoupon = null;

  if (cart.couponCode) {
    const coupon = await Coupon.findOne({
      code: cart.couponCode.toUpperCase(),
      isActive: true,
    });

    if (coupon) {
      const now = new Date();

      const isExpired = coupon.validTill < now;
      const isNotStarted = coupon.validFrom > now;

      const usageExceeded =
        coupon.usageLimit && coupon.usedCount >= coupon.usageLimit;

      const orderEligible = subTotal >= coupon.minOrderAmount;

      let userEligible = true;

      if (coupon.couponType === "INDIVIDUAL" && userId) {
        userEligible = coupon.assignedUsers.some(
          (id) => id.toString() === userId.toString(),
        );
      }

      let alreadyUsed = false;

      if (coupon.oneTimePerUser && userId) {
        alreadyUsed = coupon.usedBy.some(
          (item) => item.user.toString() === userId.toString(),
        );
      }

      const isValid =
        !isExpired &&
        !isNotStarted &&
        !usageExceeded &&
        orderEligible &&
        userEligible &&
        !alreadyUsed;

      if (isValid) {
        if (coupon.type === "PERCENTAGE") {
          discount = (subTotal * coupon.discount) / 100;

          if (coupon.maxDiscount && discount > coupon.maxDiscount) {
            discount = coupon.maxDiscount;
          }
        } else {
          // A FLAT coupon's discount is a fixed rupee amount set at coupon
          // creation, independent of any given cart's subtotal — without
          // this cap it can exceed subTotal and drive totalAmount negative.
          discount = Math.min(coupon.discount, subTotal);
        }

        appliedCoupon = coupon.code;
      } else {
        cart.couponCode = null;
      }
    } else {
      cart.couponCode = null;
    }
  }

  const roundedDiscount = Math.round(discount);

  let tax = 0;

  cart.items.forEach((item) => {
    const product = productMap.get(item.product.toString());

    // Order-level coupon discount is allocated proportionally across items
    // (by subtotal share) so each item's taxable value is discount-adjusted
    // before its own GST rate is applied — needed since items can carry
    // different product-level GST configs.
    const itemShare = subTotal > 0 ? item.total / subTotal : 0;
    const itemDiscount = roundedDiscount * itemShare;
    const taxableValue = Math.max(0, item.total - itemDiscount);

    const gst = computeGst(taxableValue, product?.gst);

    item.taxRate = gst.rate;
    item.taxType = gst.type;
    item.taxAmount = gst.taxAmount;

    // Inclusive-type GST is already baked into the item price — only
    // exclusive-type tax gets added on top of the cart total.
    if (gst.type !== "inclusive") {
      tax += gst.taxAmount;
    }
  });

  tax = Math.round(tax * 100) / 100;

  cart.subTotal = subTotal;
  cart.shipping = shipping;
  // Breakdown of `shipping` by source — always sums back to it. Lets
  // callers show either one merged "Shipping" line or two separate ones
  // (Setting.shipping.displayMode is the admin's live choice of which).
  cart.selfShippingAmount = selfShipping;
  cart.discount = roundedDiscount;
  cart.tax = tax;

  // Defense in depth alongside the FLAT-discount cap above — never let a
  // rounding edge case or a future discount type push this negative.
  cart.totalAmount = Math.max(0, subTotal - roundedDiscount + shipping + tax);

  cart.appliedCoupon = appliedCoupon;

  return cart;
};

/**
 * Atomically claims one use of a coupon at order-confirmation time — the
 * eligibility check in calculateCart() above (usedCount vs usageLimit,
 * usedBy vs userId) runs against a plain read, and every caller of this
 * function used to re-apply it with a bare `$inc`/`$push` with no
 * re-check, so two concurrent checkouts racing on a `usageLimit: 1` or
 * `oneTimePerUser: true` coupon could both pass validation and both
 * increment, exceeding the intended limit. Folding the same condition into
 * the update's filter makes the check-and-increment one atomic operation:
 * only as many concurrent callers as the coupon actually has room for can
 * ever get a non-null result back.
 *
 * Returns the updated coupon doc if the claim succeeded, or `null` if it
 * lost the race (limit already hit, or this user already used it). By the
 * time this runs the order's payment has already been resolved one way or
 * another (COD, or a captured Razorpay payment) — a `null` here doesn't
 * roll back the order, it just means this particular order's discount
 * won't be reflected in the coupon's usage bookkeeping. Callers should log
 * this rather than throw.
 */
export async function claimCouponUsage(code, userId, session = null, orderId = null) {
  if (!code) return null;

  const coupon = await Coupon.findOne({ code: code.toUpperCase() }).session(session);
  if (!coupon) return null;

  const query = { code: code.toUpperCase() };

  if (coupon.usageLimit != null) {
    query.$expr = { $lt: ["$usedCount", coupon.usageLimit] };
  }

  if (coupon.oneTimePerUser && userId) {
    query["usedBy.user"] = { $ne: userId };
  }

  return Coupon.findOneAndUpdate(
    query,
    {
      $inc: { usedCount: 1 },
      $push: { usedBy: { user: userId, usedAt: new Date(), order: orderId } },
    },
    { returnDocument: "after", session },
  );
}

/**
 * Counterpart to claimCouponUsage — nothing previously released a claimed
 * use when the order it was claimed for got cancelled/refunded, so a
 * usageLimit:1 or oneTimePerUser coupon was permanently burned by an order
 * that never actually completed. Called from order cancellation once the
 * cancellation itself is confirmed. Matched (and $pulled) by `order`, not
 * just `user` — pulling by user alone would remove *every* usedBy entry for
 * that user, over-releasing on a coupon that allows multiple uses per user
 * (oneTimePerUser: false, usageLimit > 1) if they'd used it on more than
 * one order. Best-effort: no-ops quietly if the coupon was deleted or this
 * order never actually claimed a use (e.g. claimCouponUsage itself lost the
 * race at order time and never incremented anything).
 */
export async function releaseCouponUsage(code, orderId, session = null) {
  if (!code || !orderId) return null;

  const coupon = await Coupon.findOne({ code: code.toUpperCase() }).session(session);
  if (!coupon) return null;

  const hadClaim = coupon.usedBy.some((entry) => String(entry.order) === String(orderId));
  if (!hadClaim) return null;

  return Coupon.findOneAndUpdate(
    { code: code.toUpperCase(), usedCount: { $gt: 0 } },
    {
      $inc: { usedCount: -1 },
      $pull: { usedBy: { order: orderId } },
    },
    { returnDocument: "after", session },
  );
}
