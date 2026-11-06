import express from "express";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";
import {
  getAllShipments,
  getOrderShipments,
  getShipmentById,
  retryShipmentHandler,
  generateLabelHandler,
} from "./shipment.controller.js";

const router = express.Router();

router.get("/", adminVerifyJWT, authorize("shipments.view"), getAllShipments);

// Registered BEFORE /:shipmentId — that dynamic segment would otherwise
// swallow the literal "order" path (Express matches by registration order).
router.get("/order/:orderId", adminVerifyJWT, authorize("shipments.view"), getOrderShipments);

router.get("/:shipmentId", adminVerifyJWT, authorize("shipments.view"), getShipmentById);

router.post("/:shipmentId/retry", adminVerifyJWT, authorize("shipments.edit"), retryShipmentHandler);

router.post("/:shipmentId/label", adminVerifyJWT, authorize("shipments.edit"), generateLabelHandler);

export default router;
