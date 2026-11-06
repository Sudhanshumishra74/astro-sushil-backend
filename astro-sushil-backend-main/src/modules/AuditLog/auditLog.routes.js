import express from "express";
import { getAuditLogs } from "./auditLog.controller.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";

const router = express.Router();

router.get("/", adminVerifyJWT, authorize("activityLog.view"), getAuditLogs);

export default router;
