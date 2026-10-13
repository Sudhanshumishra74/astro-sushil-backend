import express from "express";
import {
  createBlog,
  updateBlog,
  getBlogs,
  getBlogById,
  deleteBlog,
  getBlogBySlug,
} from "./blog.controller.js";
import upload from "../../middlewares/multer.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";


const router = express.Router();

router.post(
  "/",
  adminVerifyJWT,
  authorize("blogs.create"),
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  createBlog
);

router.put(
  "/:id",
  adminVerifyJWT,
  authorize("blogs.edit"),
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  updateBlog
);

router.get("/", getBlogs);
router.get("/:id", getBlogById);
router.delete("/:id", adminVerifyJWT, authorize("blogs.delete"), deleteBlog);
router.get("/slug/:slug", getBlogBySlug);

export default router;