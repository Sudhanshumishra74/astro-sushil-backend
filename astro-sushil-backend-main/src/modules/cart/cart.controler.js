import mongoose from "mongoose";
import { calculateCart } from "../../common/priceengine.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Product } from "../products/product.modal.js";
import Cart from "./cart.modal.js";
import {
  addToCartSchema,
  applyCouponSchema,
  removeItemSchema,
  updateCartSchema,
} from "./cart.validation.js";
import { Coupon } from "../coupon/coupon.model.js";

export const addToCart = asyncHandler(async (req, res) => {
  const parsed = addToCartSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid input");

  const { productId, variantId, quantity } = parsed.data;

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");

  let price,
    mrp,
    finalVariantId = null;

  if (product.hasVariants) {
    if (!variantId) throw new ApiError(400, "Variant required");

    const variant = product.variants.id(variantId);
    if (!variant) throw new ApiError(404, "Variant not found");

    price = variant.price;
    mrp = variant.mrp;
    finalVariantId = variantId;
  } else {
    price = product.price;
    mrp = product.mrp;
  }

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  const existing = cart.items.find(
    (i) =>
      i.product.toString() === productId &&
      String(i.variantId || "") === String(finalVariantId || ""),
  );

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({
      product: product._id,
      variantId: finalVariantId,
      name: product.name,
      thumbnail: product.thumbnail,
      quantity,
      price,
      mrp,
    });
  }

 await calculateCart(cart, req.user._id);
  await cart.save();

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
  const products = await mongoose
    .model("Product")
    .find({ _id: { $in: productIds } }, { _id: 1, type: 1 });

  // Map banao id => type
  const productTypeMap = {};
  products.forEach((p) => {
    productTypeMap[p._id.toString()] = p.type;
  });

  const cartObj = cart.toObject();
  cartObj.items = cartObj.items.map((item) => ({
    ...item,
    productType: productTypeMap[item.product.toString()] || "physical",
  }));

  res.json(new ApiResponse(200, cartObj, "Cart fetched"));
});

export const updateCart = asyncHandler(async (req, res) => {
  const parsed = updateCartSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid input");

  const { productId, variantId, quantity } = parsed.data;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw new ApiError(404, "Cart not found");

  const item = cart.items.find(
    (i) =>
      i.product.toString() === productId &&
      String(i.variantId || "") === String(variantId || ""),
  );

  if (!item) throw new ApiError(404, "Item not found");

  item.quantity = quantity;

 await calculateCart(cart, req.user._id);
  await cart.save();

  res.json(new ApiResponse(200, cart, "Cart updated"));
});

export const removeItem = asyncHandler(async (req, res) => {
  const parsed = removeItemSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid input");
  }

  const { productId, variantId } = parsed.data;

  const cart = await Cart.findOne({
    user: req.user._id,
  });

  if (!cart) {
    throw new ApiError(404, "Cart not found");
  }

  const itemExists = cart.items.some(
    (i) =>
      i.product.toString() === productId &&
      String(i.variantId ?? null) === String(variantId ?? null),
  );

  if (!itemExists) {
    throw new ApiError(404, "Item not found");
  }

  cart.items = cart.items.filter(
    (i) =>
      !(
        i.product.toString() === productId &&
        String(i.variantId ?? null) === String(variantId ?? null)
      ),
  );

  await calculateCart(cart, req.user._id);

  await cart.save();

  res.json(new ApiResponse(200, cart, "Item removed"));
});

export const applyCoupon = asyncHandler(async (req, res) => {
  const parsed = applyCouponSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid input");
  }

  const { code } = parsed.data;

  const cart = await Cart.findOne({
    user: req.user._id,
  });

  if (!cart) {
    throw new ApiError(404, "Cart not found");
  }

  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
  });

  if (!coupon) {
    throw new ApiError(400, "Invalid coupon");
  }

  cart.couponCode = code.toUpperCase();

  await calculateCart(cart, req.user._id);

 if (!cart.appliedCoupon) {
  throw new ApiError(
    400,
    cart.couponError ||
      "Coupon not applicable"
  );
}

  await cart.save();

  res.json(
    new ApiResponse(200, cart, "Coupon applied")
  );
});

export const clearCart = asyncHandler(async (req, res) => {
  await Cart.findOneAndUpdate(
    { user: req.user._id },
    { items: [], subTotal: 0, totalAmount: 0 },
  );

  res.json(new ApiResponse(200, {}, "Cart cleared"));
});
