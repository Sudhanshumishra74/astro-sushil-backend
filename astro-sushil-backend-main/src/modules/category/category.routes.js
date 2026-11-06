import express from "express";

import {
  createCategory,
  getCategories,
  getAdminCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  getCategoryTree,
} from "./category.controller.js";
import upload from "../../middlewares/multer.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";

const router = express.Router();

router.post("/", adminVerifyJWT, authorize("categories.create"), upload.single("image"), createCategory);

router.get("/", getCategories);
router.get("/tree", getCategoryTree);

// Registered BEFORE /:id below — that dynamic segment would otherwise
// swallow this literal path (Express matches by registration order), same
// fix already applied to product.routes.js's "/admin" route.
router.get("/admin", adminVerifyJWT, authorize("categories.view"), getAdminCategories);

router.get("/:id", getCategory);

router.put("/:id", adminVerifyJWT, authorize("categories.edit"), upload.single("image"), updateCategory);

router.delete("/:id", adminVerifyJWT, authorize("categories.delete"), deleteCategory);

export default router;