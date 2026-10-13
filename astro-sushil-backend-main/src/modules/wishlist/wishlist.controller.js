import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import {
  addToWishlistSchema,
  removeFromWishlistSchema,
} from "./wishlist.validation.js";
import Wishlist from "./wishlist.modal.js";
import {Product} from "../products/product.modal.js";

export const getWishlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  let wishlist = await Wishlist
    .findOne({ user: userId })
    .populate("products.product");

  if (!wishlist) {
    wishlist = await Wishlist.create({
      user: userId,
      products: [],
    });
  }

  return res.json(new ApiResponse(200, wishlist));
});

export const addToWishlist = asyncHandler(async (req, res) => {
  const parsed = addToWishlistSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Validation failed", parsed.error.issues);
  }

  const { productId } = parsed.data;
  const userId = req.user._id;

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");

  let wishlist = await Wishlist.findOne({ user: userId });

  if (!wishlist) {
    wishlist = await Wishlist.create({
      user: userId,
      products: [],
    });
  }

  const alreadyExists = wishlist.products.some(
    (item) => item.product.toString() === productId,
  );

  if (alreadyExists) {
    throw new ApiError(400, "Already in wishlist");
  }

  wishlist.products.push({ product: productId });

  await wishlist.save();

  return res.json(new ApiResponse(200, wishlist, "Added to wishlist"));
});

export const removeFromWishlist = asyncHandler(async (req, res) => {
  const parsed = removeFromWishlistSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Validation failed", parsed.error.issues);
  }

  const { productId } = parsed.data;
  const userId = req.user._id;

  const wishlist = await Wishlist.findOne({ user: userId });

  if (!wishlist) {
    throw new ApiError(404, "Wishlist not found");
  }

  wishlist.products = wishlist.products.filter(
    (item) => item.product.toString() !== productId,
  );

  await wishlist.save();

  return res.json(new ApiResponse(200, wishlist, "Removed from wishlist"));
});

export const clearWishlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const wishlist = await Wishlist.findOne({ user: userId });

  if (!wishlist) {
    throw new ApiError(404, "Wishlist not found");
  }

  wishlist.products = [];

  await wishlist.save();

  return res.json(new ApiResponse(200, wishlist, "Wishlist cleared"));
});

export const toggleWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const userId = req.user._id;

  let wishlist = await Wishlist.findOne({ user: userId });

  if (!wishlist) {
    wishlist = await Wishlist.create({ user: userId, products: [] });
  }

  const existsIndex = wishlist.products.findIndex(
    (item) => item.product.toString() === productId,
  );

  if (existsIndex > -1) {
    wishlist.products.splice(existsIndex, 1);
  } else {
    wishlist.products.push({ product: productId });
  }

  await wishlist.save();

 return res.json(
  new ApiResponse(
    200,
    wishlist,
    "Wishlist updated",
    {
      inWishlist: existsIndex === -1,
    },
  ),
);
});
