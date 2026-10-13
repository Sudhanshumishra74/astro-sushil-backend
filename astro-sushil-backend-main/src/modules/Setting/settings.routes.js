import express from "express";
import {
  getDashboardData,
  getSettings,
  updateSettings,
} from "./setting.controller.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";


const router = express.Router();

router.get("/", getSettings);

router.put("/", adminVerifyJWT, authorize("settings.edit"), updateSettings);
router.get("/dashboard", adminVerifyJWT, authorize("dashboard.view"), getDashboardData);

export default router;
