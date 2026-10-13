import express from "express";
import {
  setAvailability,
  getAvailability,
  blockFullDay,
  unblockFullDay,
  blockSlots,
  unblockSlots,
  getScheduleByDate,
  getAvailableSlots,
  getAdminAvailableSlots,
  getBlockedDatesByMonth,
} from "./availability.controler.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";

const router = express.Router();


router.post("/", adminVerifyJWT, authorize("availability.edit"), setAvailability);
router.get("/", adminVerifyJWT, authorize("availability.view"), getAvailability);


router.post("/block-day", adminVerifyJWT, authorize("availability.edit"), blockFullDay);
router.post("/unblock-day", adminVerifyJWT, authorize("availability.edit"), unblockFullDay);

router.post("/block-slots", adminVerifyJWT, authorize("availability.edit"), blockSlots);
router.post("/unblock-slots", adminVerifyJWT, authorize("availability.edit"), unblockSlots);


router.get("/schedule", adminVerifyJWT, authorize("availability.view"), getScheduleByDate);
router.get("/blocked-dates", getBlockedDatesByMonth);
router.get("/slots", getAvailableSlots);
router.get("/admin-slots", adminVerifyJWT, authorize("availability.view"), getAdminAvailableSlots);

export default router;
