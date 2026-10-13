import express from "express";

import {
  createOrder,
  verifyPayment,
  getMyOrders,
  getOrderDetails,
  cancelOrder,
  downloadInvoice,
  getAllOrders,
  getAdminOrderDetails,
  updateOrderStatus,
  getOrderReports,
} from "./order.controller.js";

import { verifyToken } from "../../middlewares/verifyToken.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";
import { checkPhysicalProductAddress } from "../../middlewares/checkPhysicalProductAddress.js";

const router = express.Router();

router.get("/admin/all", adminVerifyJWT, authorize("orders.view"), getAllOrders);
router.get("/admin/reports", adminVerifyJWT, authorize("orders.export"), getOrderReports);
router.get("/admin/:orderId", adminVerifyJWT, authorize("orders.view"), getAdminOrderDetails);
router.patch("/admin/:orderId/status", adminVerifyJWT, authorize("orders.edit"), updateOrderStatus);

router.post("/create", verifyToken, checkPhysicalProductAddress, createOrder);
router.post("/verify-payment", verifyToken, verifyPayment);

router.get("/my-orders", verifyToken, getMyOrders);

router.patch("/:orderId/cancel", verifyToken, cancelOrder);
router.get("/:orderId/invoice", verifyToken, downloadInvoice);

router.get("/:orderId", verifyToken, getOrderDetails);

export default router;
