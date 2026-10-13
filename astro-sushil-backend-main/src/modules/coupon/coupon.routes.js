import express from "express";
import { createCouponSchema, updateCouponSchema } from "./coupon.validation.js";
import { validate } from "../../middlewares/validate.js";
import {
  createCoupon,
  deleteCoupon,
  getCouponById,
  getCoupons,
  getFrontendCoupons,
  toggleCouponStatus,
  updateCoupon,
} from "./coupon.controller.js";
import { applyCouponSchema } from "../cart/cart.validation.js";
import { verifyToken } from "../../middlewares/verifyToken.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";

const router = express.Router();

// The customer-facing storefront never calls these — coupon codes are
// applied via cart/coupon, and the only public coupon read is /frontend
// below. These are admin-only despite lacking adminVerifyJWT previously.
router.get("/", adminVerifyJWT, authorize("coupons.view"), getCoupons);
router.post(
  "/create",
  adminVerifyJWT,
  authorize("coupons.create"),
  validate(createCouponSchema),
  createCoupon,
);
router.put(
  "/:couponId",
  adminVerifyJWT,
  authorize("coupons.edit"),
  validate(updateCouponSchema),
  updateCoupon,
);

router.delete("/:couponId", adminVerifyJWT, authorize("coupons.delete"), deleteCoupon);

router.patch("/toggle/:couponId", adminVerifyJWT, authorize("coupons.edit"), toggleCouponStatus);

router.get("/frontend", verifyToken, getFrontendCoupons);

router.get("/:couponId", verifyToken, adminVerifyJWT, authorize("coupons.view"), getCouponById);

export default router;
