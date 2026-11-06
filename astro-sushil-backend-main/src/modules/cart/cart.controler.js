import mongoose from "mongoose";
import { calculateCart } from "../../common/priceengine.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Product } from "../products/product.modal.js";
import { isValidRatti } from "../../utils/ratti.js";
import Cart from "./cart.modal.js";
import {
  addToCartSchema,
  applyCouponSchema,
  removeItemSchema,
  updateCartSchema,
} from "./cart.validation.js";
import { Coupon } from "../coupon/coupon.model.js";
import Setting from "../Setting/Setting.model.js";

const MAX_CART_SAVE_RETRIES = 3;

// Every cart mutation reads the whole document, mutates `items` in JS, then
// saves — under Mongoose's default array versioning, two concurrent
// mutations on the same cart (rapid +/- clicks, two tabs) race: the first
// save wins and bumps `__v`, the second's conditional save matches nothing
// and throws a VersionError that used to surface as an unhandled 500.
// `fn` gets a freshly-(re)fetched cart each attempt and is responsible for
// the actual mutation, any calculateCart() call, and any validation that
// needs to happen before save (throwing anything other than a
// VersionError aborts immediately, without retrying).
async function withCartRetry(userId, { createIfMissing = false } = {}, fn) {
  let lastErr;

  for (let attempt = 0; attempt < MAX_CART_SAVE_RETRIES; attempt++) {
    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      if (!createIfMissing) throw new ApiError(404, "Cart not found");
      cart = await Cart.create({ user: userId, items: [] });
    }

    try {
      await fn(cart);
      await cart.save();
      return cart;
    } catch (err) {
      if (err instanceof mongoose.Error.VersionError && attempt < MAX_CART_SAVE_RETRIES - 1) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }

  throw lastErr;
}

export const addToCart = asyncHandler(async (req, res) => {
  const parsed = addToCartSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid input");

  const {
    productId,
    variantId,
    subVariantId,
    selectedRatti,
    certificateId,
    quantity,
  } = parsed.data;

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");
  if (!product.isPublished) {
    throw new ApiError(400, `${product.name} is no longer available`);
  }

  let price,
    mrp,
    finalVariantId = null,
    finalSubVariantId = null,
    finalVariantName = null,
    finalVariantValue = null,
    finalSubVariantName = null,
    finalSubVariantValue = null,
    finalSelectedRatti = null,
    finalQuantity = quantity,
    effectiveStock;

  // Never trust a client-sent certificate price — resolve it server-side
  // from the product's own certificates list, same as variant/ratti pricing
  // above. Gated by the global Setting.product.certificatesEnabled switch:
  // a certificateId sent while the feature is off is rejected outright.
  let finalCertificateId = null,
    finalCertificateName = null,
    finalCertificatePrice = 0,
    finalCertificateIncludedInPrice = false;

  if (certificateId) {
    const settings = await Setting.findOne().select("product.certificatesEnabled").lean();
    if (!settings?.product?.certificatesEnabled) {
      throw new ApiError(400, "Certificates are not available right now");
    }

    const certificate = product.certificates?.id(certificateId);
    if (!certificate) throw new ApiError(404, "Certificate not found");

    finalCertificateId = certificateId;
    finalCertificateName = certificate.name;
    finalCertificateIncludedInPrice = certificate.includedInPrice;
    finalCertificatePrice = certificate.includedInPrice ? 0 : (certificate.price || 0);
  }

  if (product.soldByRatti) {
    if (!isValidRatti(selectedRatti, product.minRatti, product.maxRatti, product.outOfStockRattis)) {
      throw new ApiError(400, "Invalid or out-of-stock ratti selected");
    }

    finalSelectedRatti = Number(selectedRatti);
    // product.price/mrp are already the discounted/undiscounted rate for 1
    // ratti (see product.modal.js's pre-save hook) — the line total just
    // scales with the selected weight.
    price = Math.round(product.price * finalSelectedRatti * 100) / 100;
    mrp = Math.round(product.mrp * finalSelectedRatti * 100) / 100;
    effectiveStock = product.stock;
  } else if (product.hasVariants) {
    if (!variantId) throw new ApiError(400, "Variant required");

    const variant = product.variants.id(variantId);
    if (!variant) throw new ApiError(404, "Variant not found");

    finalVariantId = variantId;
    finalVariantName = variant.name;
    finalVariantValue = variant.value;

    if (variant.subVariants?.length > 0) {
      if (!subVariantId) throw new ApiError(400, "Sub-variant required");

      const subVariant = variant.subVariants.id(subVariantId);
      if (!subVariant) throw new ApiError(404, "Sub-variant not found");

      price = subVariant.price;
      mrp = subVariant.mrp;
      finalSubVariantId = subVariantId;
      finalSubVariantName = subVariant.name;
      finalSubVariantValue = subVariant.value;
      effectiveStock = subVariant.stock;
    } else {
      price = variant.price;
      mrp = variant.mrp;
      effectiveStock = variant.stock;
    }
  } else {
    price = product.price;
    mrp = product.mrp;
    effectiveStock = product.stock;
  }

  const cart = await withCartRetry(req.user._id, { createIfMissing: true }, async (cart) => {
    const existing = findCartItem(cart, {
      productId,
      variantId: finalVariantId,
      subVariantId: finalSubVariantId,
      selectedRatti: finalSelectedRatti,
      certificateId: finalCertificateId,
    });

    if (existing) {
      // Cap growth at the matching stock count — the *selected variant's*
      // stock for a hasVariants product, not the unrelated top-level
      // product.stock (which used to cap every variant's cart line against
      // whatever number happened to sit on the parent product doc).
      const nextQuantity = existing.quantity + finalQuantity;
      existing.quantity =
        effectiveStock > 0 ? Math.min(nextQuantity, effectiveStock) : nextQuantity;
    } else {
      cart.items.push({
        product: product._id,
        variantId: finalVariantId,
        subVariantId: finalSubVariantId,
        variantName: finalVariantName,
        variantValue: finalVariantValue,
        subVariantName: finalSubVariantName,
        subVariantValue: finalSubVariantValue,
        selectedRatti: finalSelectedRatti,
        certificateId: finalCertificateId,
        certificateName: finalCertificateName,
        certificatePrice: finalCertificatePrice,
        certificateIncludedInPrice: finalCertificateIncludedInPrice,
        name: product.name,
        thumbnail: product.thumbnail,
        quantity: finalQuantity,
        price,
        mrp,
      });
    }

    await calculateCart(cart, req.user._id);
  });

  res.json(new ApiResponse(200, cart, "Added to cart"));
});

export const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    return res.json(new ApiResponse(200, { items: [] }, "Empty cart"));
  }

  // Product IDs nikalo
  const productIds = cart.items.map((item) => item.product);

  // Alag se Product fetch karo
  const products = await Product.find(
    { _id: { $in: productIds } },
    { _id: 1, type: 1, isPublished: 1 },
  );

  // Map banao id => type
  const productTypeMap = {};
  const publishedMap = {};
  products.forEach((p) => {
    productTypeMap[p._id.toString()] = p.type;
    publishedMap[p._id.toString()] = p.isPublished;
  });

  const cartObj = cart.toObject();
  cartObj.items = cartObj.items.map((item) => ({
    ...item,
    productType: productTypeMap[item.product.toString()] || "physical",
    // Surfaced so the cart page can warn/disable checkout for this line
    // instead of the customer only finding out at createOrder — an admin
    // unpublish or a hard delete both leave the item missing/false here
    // (a deleted product's id was never in `products` at all, so the
    // lookup misses and the `?? true` default below catches it too).
    isUnavailable: publishedMap[item.product.toString()] === false
      || !(item.product.toString() in publishedMap),
  }));

  // Live admin preference (Setting.shipping.displayMode), not snapshotted —
  // lets the cart page render selfShippingAmount as one merged line or a
  // separate one.
  const settings = await Setting.findOne().select("shipping.displayMode").lean();
  cartObj.shippingDisplayMode = settings?.shipping?.displayMode || "merged";

  res.json(new ApiResponse(200, cartObj, "Cart fetched"));
});

// Prefer the subdocument's own _id when the caller has one — it's the only
// unambiguous identifier. The composite product+variant fallback exists for
// callers that don't have an itemId yet, but breaks down whenever two lines
// share a product with no variant difference to tell them apart — that
// ambiguity is exactly what let a quantity +/- on one cart row silently
// mutate a different row.
const findCartItem = (cart, { itemId, productId, variantId, subVariantId, selectedRatti, certificateId }) => {
  if (itemId) return cart.items.id(itemId);

  return cart.items.find((i) => {
    if (i.product.toString() !== productId) return false;

    return (
      String(i.variantId || "") === String(variantId || "") &&
      String(i.subVariantId || "") === String(subVariantId || "") &&
      String(i.selectedRatti ?? "") === String(selectedRatti ?? "") &&
      String(i.certificateId || "") === String(certificateId || "")
    );
  });
};

export const updateCart = asyncHandler(async (req, res) => {
  const parsed = updateCartSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid input");

  const {
    itemId,
    productId,
    variantId,
    subVariantId,
    selectedRatti,
    certificateId,
    quantity,
  } = parsed.data;

  const cart = await withCartRetry(req.user._id, {}, async (cart) => {
    const item = findCartItem(cart, { itemId, productId, variantId, subVariantId, selectedRatti, certificateId });

    if (!item) throw new ApiError(404, "Item not found");

    item.quantity = quantity;

    await calculateCart(cart, req.user._id);
  });

  res.json(new ApiResponse(200, cart, "Cart updated"));
});

export const removeItem = asyncHandler(async (req, res) => {
  const parsed = removeItemSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid input");
  }

  const { itemId, productId, variantId, subVariantId, selectedRatti, certificateId } = parsed.data;

  const cart = await withCartRetry(req.user._id, {}, async (cart) => {
    const itemToRemove = findCartItem(cart, { itemId, productId, variantId, subVariantId, selectedRatti, certificateId });

    if (!itemToRemove) {
      throw new ApiError(404, "Item not found");
    }

    cart.items = cart.items.filter((i) => i !== itemToRemove);

    await calculateCart(cart, req.user._id);
  });

  res.json(new ApiResponse(200, cart, "Item removed"));
});

export const applyCoupon = asyncHandler(async (req, res) => {
  const parsed = applyCouponSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid input");
  }

  const { code } = parsed.data;

  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
  });

  if (!coupon) {
    throw new ApiError(400, "Invalid coupon");
  }

  const cart = await withCartRetry(req.user._id, {}, async (cart) => {
    cart.couponCode = code.toUpperCase();

    await calculateCart(cart, req.user._id);

    if (!cart.appliedCoupon) {
      throw new ApiError(400, cart.couponError || "Coupon not applicable");
    }
  });

  res.json(
    new ApiResponse(200, cart, "Coupon applied")
  );
});

// There used to be no backend counterpart to the frontend's "Remove coupon"
// button at all — it only cleared local Zustand state, while
// cart.couponCode stayed set server-side and calculateCart kept re-applying
// it on every subsequent cart read/mutation (including at order creation).
// A customer who clicked Remove would still be charged the discounted
// price with no visual indication why.
export const removeCoupon = asyncHandler(async (req, res) => {
  const cart = await withCartRetry(req.user._id, {}, async (cart) => {
    cart.couponCode = null;
    await calculateCart(cart, req.user._id);
  });

  res.json(new ApiResponse(200, cart, "Coupon removed"));
});

export const clearCart = asyncHandler(async (req, res) => {
  await Cart.findOneAndUpdate(
    { user: req.user._id },
    { items: [], subTotal: 0, totalAmount: 0 },
  );

  res.json(new ApiResponse(200, {}, "Cart cleared"));
});
