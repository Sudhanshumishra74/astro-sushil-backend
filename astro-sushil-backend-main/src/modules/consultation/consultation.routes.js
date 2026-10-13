import express from "express";
import {
  createConsultation,
  updateConsultation,
  getSlots,
  blockDate,
  getConsultationById,
  getConsultations,
  unblockDate,
  getBlockedDates,
  deleteConsultation,
  getConsultationsAdmin,
  getConsultationsAdminAll,
} from "./consultation.controler.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";
import { verifyToken } from "../../middlewares/verifyToken.js";

const router = express.Router();

router.get("/", getConsultations);
router.get("/admin", adminVerifyJWT, authorize("consultations.view"), getConsultationsAdmin);
router.get("/admin/all", adminVerifyJWT, authorize("consultations.view"), getConsultationsAdminAll);
router.post("/admin/create", adminVerifyJWT, authorize("consultations.create"), createConsultation);
router.post("/admin/block-date", adminVerifyJWT, authorize("consultations.edit"), blockDate);
router.put("/admin/:id", adminVerifyJWT, authorize("consultations.edit"), updateConsultation);
router.post("/admin/unblock-date", adminVerifyJWT, authorize("consultations.edit"), unblockDate);
router.get("/admin/blocked-dates/:id", adminVerifyJWT, authorize("consultations.view"), getBlockedDates);
router.delete("/admin/:id", adminVerifyJWT, authorize("consultations.delete"), deleteConsultation);
router.get("/slots", getSlots);

router.get("/:id", getConsultationById);
export default router;
  