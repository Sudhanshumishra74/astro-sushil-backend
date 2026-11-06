import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { Coupon } from "./coupon.model.js";
import { diffFields, logActivity } from "../AuditLog/auditLog.service.js";

export const createCoupon = asyncHandler(async (req, res) => {
  const data = req.validatedData;

  const existingCoupon = await Coupon.findOne({
    code: data.code.toUpperCase(),
  });

  if (existingCoupon) {
    throw new ApiError(400, "Coupon already exists");
  }

  if (
    data.couponType === "INDIVIDUAL" &&
    (!data.assignedUsers || data.assignedUsers.length === 0)
  ) {
    throw new ApiError(400, "Assigned users required for individual coupon");
  }

  const coupon = await Coupon.create({
    ...data,
    code: data.code.toUpperCase(),
  });

  await logActivity({
    admin: req.user,
    action: "coupon.create",
    targetType: "Coupon",
    targetId: coupon._id,
    targetLabel: coupon?.code,
    changes: [],
  });

  return res.status(201).json(new ApiResponse(201, coupon, "Coupon created"));
});

export const updateCoupon = asyncHandler(async (req, res) => {
  const { couponId } = req.params;

  const data = req.validatedData;

  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    throw new ApiError(404, "Coupon not found");
  }

  // prevent duplicate code
  if (data.code) {
    const existingCoupon = await Coupon.findOne({
      code: data.code.toUpperCase(),
      _id: { $ne: couponId },
    });

    if (existingCoupon) {
      throw new ApiError(400, "Coupon code already exists");
    }

    data.code = data.code.toUpperCase();
  }

  // validation for individual coupon
  if (
    data.couponType === "INDIVIDUAL" &&
    (!data.assignedUsers || data.assignedUsers.length === 0)
  ) {
    throw new ApiError(400, "Assigned users required for individual coupon");
  }

  const before = await Coupon.findById(couponId).lean();

  const updatedCoupon = await Coupon.findByIdAndUpdate(
    couponId,
    {
      $set: data,
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  await logActivity({
    admin: req.user,
    action: "coupon.update",
    targetType: "Coupon",
    targetId: couponId,
    targetLabel: updatedCoupon?.code ?? before?.code,
    changes: diffFields(before, updatedCoupon?.toObject?.() ?? updatedCoupon, Object.keys(req.body)),
    skipIfNoChanges: true,
  });

  res.json(new ApiResponse(200, updatedCoupon, "Coupon updated successfully"));
});
export const deleteCoupon = asyncHandler(async (req, res) => {
  const { couponId } = req.params;

  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    throw new ApiError(404, "Coupon not found");
  }

  const deletedCode = coupon?.code;

  await Coupon.findByIdAndDelete(couponId);

  await logActivity({
    admin: req.user,
    action: "coupon.delete",
    targetType: "Coupon",
    targetId: couponId,
    targetLabel: deletedCode,
    changes: [],
  });

  res.json(new ApiResponse(200, null, "Coupon deleted successfully"));
});
export const toggleCouponStatus = asyncHandler(async (req, res) => {
  const { couponId } = req.params;

  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    throw new ApiError(404, "Coupon not found");
  }

  const wasActive = coupon.isActive;

  coupon.isActive = !coupon.isActive;

  await coupon.save();

  await logActivity({
    admin: req.user,
    action: "coupon.toggle_status",
    targetType: "Coupon",
    targetId: coupon._id,
    targetLabel: coupon?.code,
    changes: diffFields({ isActive: wasActive }, { isActive: coupon.isActive }, ["isActive"]),
    skipIfNoChanges: true,
  });

  res.json(
    new ApiResponse(
      200,
      {
        _id: coupon._id,
        isActive: coupon.isActive,
      },
      `Coupon ${coupon.isActive ? "enabled" : "disabled"} successfully`,
    ),
  );
});

export const getCoupons = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;

  const limit = Number(req.query.limit) || 10;

  const search = req.query.search || "";

  const skip = (page - 1) * limit;

  const query = {
    code: {
      $regex: search,
      $options: "i",
    },
  };

  const [coupons, total] = await Promise.all([
    Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("assignedUsers", "firstName email"),

    Coupon.countDocuments(query),
  ]);

  res.json(
    new ApiResponse(200, coupons, "Coupons fetched", {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }),
  );
});

export const getCouponById = asyncHandler(async (req, res) => {
  const { couponId } = req.params;

  const coupon = await Coupon.findById(couponId).populate(
    "assignedUsers",
    "firstName email",
  );

  if (!coupon) {
    throw new ApiError(404, "Coupon not found");
  }

  res.json(new ApiResponse(200, coupon, "Coupon fetched"));
});

export const getFrontendCoupons = asyncHandler(async (req, res) => {
  const now = new Date();

  const userId = req.user?._id;

  const coupons = await Coupon.find({
    isActive: true,
    validFrom: { $lte: now },
    validTill: { $gte: now },
    $or: [
      {
        couponType: "GLOBAL",
      },
      {
        couponType: "INDIVIDUAL",
        assignedUsers: userId,
      },
    ],
  }).select(
    "code description type discount maxDiscount minOrderAmount validTill",
  );

  res.json(new ApiResponse(200, coupons, "Available coupons"));
});
