import Address from "./address.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import {
  addressSchemaZod,
  addressUpdateSchemaZod,
} from "./address.validation.js";

// ✅ GET ALL
export const getAddresses = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const addresses = await Address.find({ user: userId }).sort({
    isDefault: -1,
    createdAt: -1,
  });

  return res.json(new ApiResponse(200, addresses));
});

// ✅ CREATE
export const createAddress = asyncHandler(async (req, res) => {
  const parsed = addressSchemaZod.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Validation failed", parsed.error.issues);
  }

  const userId = req.user._id;

  // ✅ If setting default → unset previous
  if (parsed.data.isDefault) {
    await Address.updateMany(
      { user: userId },
      { $set: { isDefault: false } }
    );
  }

  const address = await Address.create({
    ...parsed.data,
    user: userId,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, address, "Address created"));
});

// ✅ UPDATE
export const updateAddress = asyncHandler(async (req, res) => {
  const address = await Address.findById(req.params.id);

  if (!address) throw new ApiError(404, "Address not found");

  const parsed = addressUpdateSchemaZod.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Validation failed", parsed.error.issues);
  }

  // ✅ If setting default → unset others
  if (parsed.data.isDefault) {
    await Address.updateMany(
      { user: req.user._id },
      { $set: { isDefault: false } }
    );
  }

  Object.assign(address, parsed.data);

  await address.save();

  return res.json(new ApiResponse(200, address, "Address updated"));
});

// ✅ DELETE
export const deleteAddress = asyncHandler(async (req, res) => {
  const address = await Address.findById(req.params.id);

  if (!address) throw new ApiError(404, "Address not found");

  await address.deleteOne();

  return res.json(new ApiResponse(200, null, "Address deleted"));
});

// ✅ SET DEFAULT
export const setDefaultAddress = asyncHandler(async (req, res) => {
  const address = await Address.findById(req.params.id);

  if (!address) throw new ApiError(404, "Address not found");

  const userId = req.user._id;

  await Address.updateMany(
    { user: userId },
    { $set: { isDefault: false } }
  );

  address.isDefault = true;
  await address.save();

  return res.json(new ApiResponse(200, address, "Default set"));
});