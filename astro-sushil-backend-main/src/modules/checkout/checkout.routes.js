import express from "express";
import { verifyToken } from "../../middlewares/verifyToken.js";
import { getCheckoutInfo } from "./checkout.controller.js";

const router = express.Router();

router.get("/", verifyToken, getCheckoutInfo);

export default router;
