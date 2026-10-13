import { Coupon } from "../modules/coupon/coupon.model.js";
import { Product } from "../modules/products/product.modal.js";
import { computeGst } from "./taxEngine.js";

export const calculateCart = async (cart, userId = null) => {
  let subTotal = 0;

  cart.items.forEach((item) => {
    item.total = item.price * item.quantity;
    subTotal += item.total;
  });

  const productIds = cart.items.map((item) => item.product);
  const products = await Product.find({
    _id: { $in: productIds },
  }).select("type gst");

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const hasPhysical = products.some((p) => p.type === "physical");
  const shipping = hasPhysical ? 500 : 0;

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
          discount = coupon.discount;
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
  cart.discount = roundedDiscount;
  cart.tax = tax;

  cart.totalAmount = subTotal - roundedDiscount + shipping + tax;

  cart.appliedCoupon = appliedCoupon;

  return cart;
};
