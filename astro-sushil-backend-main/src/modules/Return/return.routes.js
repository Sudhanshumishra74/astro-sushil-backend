import express from "express";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";
import {
  getAllReturns,
  getOrderReturns,
  getReturnById,
  approveReturnHandler,
  rejectReturnHandler,
  retryReturnHandler,
  inspectReturnHandler,
  refundReturnHandler,
  cancelReturnPickupHandler,
  downloadCreditNoteAdmin,
  updateManualReturnHandler,
} from "./return.controller.js";

const router = express.Router();

router.get("/", adminVerifyJWT, authorize("returns.view"), getAllReturns);

// Registered BEFORE /:returnId — that dynamic segment would otherwise
// swallow the literal "order" path (Express matches by registration order).
router.get("/order/:orderId", adminVerifyJWT, authorize("returns.view"), getOrderReturns);

router.get("/:returnId", adminVerifyJWT, authorize("returns.view"), getReturnById);
router.get("/:returnId/credit-note", adminVerifyJWT, authorize("returns.view"), downloadCreditNoteAdmin);

router.patch("/:returnId/approve", adminVerifyJWT, authorize("returns.edit"), approveReturnHandler);
router.patch("/:returnId/reject", adminVerifyJWT, authorize("returns.edit"), rejectReturnHandler);
router.post("/:returnId/retry", adminVerifyJWT, authorize("returns.edit"), retryReturnHandler);
router.patch(
  "/:returnId/manual-status",
  adminVerifyJWT,
  authorize("returns.edit"),
  updateManualReturnHandler,
);
router.post("/:returnId/inspect", adminVerifyJWT, authorize("returns.edit"), inspectReturnHandler);
router.post("/:returnId/refund", adminVerifyJWT, authorize("returns.edit"), refundReturnHandler);
router.post(
  "/:returnId/cancel-pickup",
  adminVerifyJWT,
  authorize("returns.edit"),
  cancelReturnPickupHandler,
);

export default router;
