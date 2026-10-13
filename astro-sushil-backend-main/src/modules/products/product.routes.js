import express from "express";
import {
  createProduct,
  updateProduct,
  getProducts,
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
    { name: "variantFiles", maxCount: 10 },
  ]),
  updateProduct,
);
router.get("/", optionalVerifyToken, getProducts);
router.get("/:id", getProductById);
router.get("/slug/:slug", getProductBySlug);
router.delete("/:id", adminVerifyJWT, authorize("products.delete"), deleteProduct);

export default router;
