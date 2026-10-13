import express from "express";
import {
  createFAQ,
  getFAQs,
  getAllFAQsAdmin,
  updateFAQ,
  deleteFAQ,
} from "./faq.controller.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";

const router = express.Router();

router.get("/", getFAQs);

router.get("/admin", adminVerifyJWT, authorize("faqs.view"), getAllFAQsAdmin);
router.post("/", adminVerifyJWT, authorize("faqs.create"), createFAQ);
router.put("/:id", adminVerifyJWT, authorize("faqs.edit"), updateFAQ);
router.delete("/:id", adminVerifyJWT, authorize("faqs.delete"), deleteFAQ);

export default router;
