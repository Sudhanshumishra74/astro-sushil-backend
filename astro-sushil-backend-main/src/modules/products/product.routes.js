import express from "express";
import {
  createProduct,
  updateProduct,
  updateProductStatus,
  getProducts,
  getAdminProducts,
  getProductById,
  deleteProduct,
  getProductBySlug,
} from "./product.controller.js";
import upload from "../../middlewares/multer.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";
import { optionalVerifyToken } from "../../middlewares/optionalVerifyToken.js";

const router = express.Router();

router.post(
  "/",
  adminVerifyJWT,
  authorize("products.create"),
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "thumbnail", maxCount: 1 },
    { name: "videos", maxCount: 2 },
    { name: "variantFiles", maxCount: 10 },
  ]),
  createProduct,
);

router.put(
  "/:id",
  adminVerifyJWT,
  authorize("products.edit"),
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "thumbnail", maxCount: 1 },
    { name: "videos", maxCount: 2 },
    { name: "variantFiles", maxCount: 10 },
  ]),
  updateProduct,
);

// Deliberately separate from the general PUT above — publish/unpublish is
// a lightweight toggle that doesn't need the full update payload/validation.
router.patch(
  "/:id/status",
  adminVerifyJWT,
  authorize("products.edit"),
  updateProductStatus,
);

router.get("/", optionalVerifyToken, getProducts);
router.get("/admin", adminVerifyJWT, authorize("products.view"), getAdminProducts);

router.get("/:id", getProductById);
router.get("/slug/:slug", getProductBySlug);
router.delete("/:id", adminVerifyJWT, authorize("products.delete"), deleteProduct);

export default router;
