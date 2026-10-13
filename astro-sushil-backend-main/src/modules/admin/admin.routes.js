import express from "express";
import {
  changePassword,
  forgotPassword,
  getAdminDetails,
  loginAdmin,
  logoutAdmin,
  resetPassword,
  updateAdmin,
} from "./admin.controler.js";
import { validate } from "../../middlewares/validate.js";
import {
  changePasswordSchema,
  sendOtpSchema,
  updateAdminSchema,
  verifyOtpSchema,
} from "./admin.validation.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import staffRoutes from "./staff.routes.js";

const router = express.Router();

router.use("/staff", staffRoutes);

router.post("/login", loginAdmin);

router.post("/logout",adminVerifyJWT, logoutAdmin);

router.get("/profile", adminVerifyJWT, getAdminDetails);
router.patch(
  "/update",
  adminVerifyJWT,
  validate(updateAdminSchema),
  updateAdmin,
);
router.post("/forgot-password", validate(sendOtpSchema), forgotPassword);

router.post("/reset-password", validate(verifyOtpSchema), resetPassword);
router.post(
  "/change-password",
  adminVerifyJWT,
  validate(changePasswordSchema),
  changePassword,
);

export default router;
