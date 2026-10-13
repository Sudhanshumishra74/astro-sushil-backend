import express from "express";
import upload from "../../middlewares/multer.js";
import { validate } from "../../middlewares/validate.js";
import {
  createCourse,
  deleteCourse,
  getCourseById,
  getCourseBySlug,
  getCourses,
  updateCourse,
} from "./course.controler.js";
import { createCourseSchema, updateCourseSchema } from "./course.validation.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";

const router = express.Router();

router.get("/", getCourses);

router.post(
  "/",
  adminVerifyJWT,
  authorize("courses.create"),
  upload.fields([{ name: "thumbnail", maxCount: 1 }]),
  validate(createCourseSchema),
  createCourse,
);
router.get("/:id", getCourseById);
router.get("/slug/:slug", getCourseBySlug);
router.put(
  "/:id",
  adminVerifyJWT,
  authorize("courses.edit"),
  upload.fields([{ name: "thumbnail", maxCount: 1 }]),
  validate(updateCourseSchema),
  updateCourse,
);

router.delete("/:id", adminVerifyJWT, authorize("courses.delete"), deleteCourse);

export default router;
