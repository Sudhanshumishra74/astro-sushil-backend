import express from "express";


import {
  createTestimonial,
  getTestimonials,
  getTestimonialById,
  updateTestimonial,
  deleteTestimonial,
  toggleTestimonial,
} from "./testimonial.controler.js";
import upload from "../../middlewares/multer.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import { createTestimonialSchema } from "./testimonial.validation.js";

const router = express.Router();

router.post(
  "/",
  adminVerifyJWT,
  authorize("testimonials.create"),
  upload.fields([{ name: "image", maxCount: 1 }]),
  validate(createTestimonialSchema),
  createTestimonial,
);

router.get("/", getTestimonials);

router.get("/:id", getTestimonialById);

router.put(
  "/:id",
  adminVerifyJWT,
  authorize("testimonials.edit"),
  upload.fields([{ name: "image", maxCount: 1 }]),
  updateTestimonial,
);

router.delete("/:id", adminVerifyJWT, authorize("testimonials.delete"), deleteTestimonial);

router.patch("/toggle/:id", adminVerifyJWT, authorize("testimonials.edit"), toggleTestimonial);

export default router;
