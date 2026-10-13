import express from "express";
import {
  addReport,
  buyReport,
  deleteReport,
  downloadReportInvoice,
  getAllReportOrders,
  getReportById,
  getReportBySlug,
  getReportOrders,
  getReports,
  updateReport,
  verifyReportPayment,
} from "./report.controller.js";
import { verifyToken } from "../../middlewares/verifyToken.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";
import upload from "../../middlewares/multer.js";

const router = express.Router();

router.get("/orders/all", adminVerifyJWT, authorize("reportOrders.view"), getAllReportOrders);
router.get("/orders", verifyToken, getReportOrders);
router.get("/orders/:orderId/invoice", verifyToken, downloadReportInvoice);

router.post(
  "/add",
  adminVerifyJWT,
  authorize("pdfReports.create"),
  upload.single("coverImage"),
  addReport,
);

router.put(
  "/edit/:id",
  adminVerifyJWT,
  authorize("pdfReports.edit"),
  upload.single("coverImage"),
  updateReport,
);

router.delete("/delete/:id", adminVerifyJWT, authorize("pdfReports.delete"), deleteReport);
router.get("/", getReports);
router.get("/slug/:slug", getReportBySlug);
router.get("/:id", getReportById);
router.post("/buy", verifyToken, buyReport);
router.post("/verify-payment", verifyToken, verifyReportPayment);

export default router;
