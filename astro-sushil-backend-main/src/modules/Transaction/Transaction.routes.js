import express from "express";

import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";

import { getAllTransactions, getGstReport } from "./Transaction.controler.js";

const router = express.Router();

router.get("/", adminVerifyJWT, authorize("transactions.view"), getAllTransactions);
router.get("/gst-report", adminVerifyJWT, authorize("gstReport.view"), getGstReport);

export default router;
