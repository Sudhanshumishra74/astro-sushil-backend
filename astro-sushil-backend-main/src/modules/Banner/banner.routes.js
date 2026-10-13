import express from "express";
import { validate } from "../../middlewares/validate.js";
import {
  createBanner,
  deleteBanner,
  getBannerById,
  getBanners,
  getFrontendBanners,
  toggleBannerStatus,
  updateBanner,
} from "./banner.controler.js";
import {
  bannerIdParamSchema,
  createBannerSchema,
  updateBannerSchema,
} from "./banner.validation.js";
import upload from "../../middlewares/multer.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";

const router = express.Router();

router.get("/frontend", getFrontendBanners);

router.post(
  "/",
  adminVerifyJWT,
  authorize("banners.create"),
  upload.fields([{ name: "image", maxCount: 1 }]),
  validate(createBannerSchema),
  createBanner,
);

router.get("/", adminVerifyJWT, authorize("banners.view"), getBanners);

router.get(
  "/:id",
  adminVerifyJWT,
  authorize("banners.view"),
  validate(bannerIdParamSchema, "params"),
  getBannerById,
);

router.put(
  "/:id",
  adminVerifyJWT,
  authorize("banners.edit"),
  upload.fields([{ name: "image", maxCount: 1 }]),
  validate(updateBannerSchema),
  updateBanner,
);

router.delete(
  "/:id",
  adminVerifyJWT,
  authorize("banners.delete"),
  validate(bannerIdParamSchema, "params"),
  deleteBanner,
);

router.patch(
  "/:id/toggle",
  adminVerifyJWT,
  authorize("banners.edit"),
  validate(bannerIdParamSchema, "params"),
  toggleBannerStatus,
);

export default router;
