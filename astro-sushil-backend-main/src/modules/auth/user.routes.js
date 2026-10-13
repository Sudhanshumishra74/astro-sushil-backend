import express from "express";
import { validate } from "../../middlewares/validate.js";
import {
  changePassword,
  deleteUser,
  forgotPassword,
  getAllUsers,
  getProfile,
  getUserById,
  login,
  register,
  resetPassword,
  updateProfile,
  updateProfilePhoto,
  updateUserByAdmin,
  verifyAuthOtp,
} from "./user.controler.js";
import { verifyToken } from "../../middlewares/verifyToken.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginUserSchema,
  registerUserSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyAuthSchema,
} from "./user.validation.js";
import upload from "../../middlewares/multer.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";

const router = express.Router();

router.post("/register", validate(registerUserSchema), register);
router.post("/login", validate(loginUserSchema), login);
router.post("/verify-otp", validate(verifyAuthSchema), verifyAuthOtp);
router.patch(
  "/profile",
  verifyToken,
  validate(updateProfileSchema),
  updateProfile,
);

router.post(
  "/change-password",
  verifyToken,
  validate(changePasswordSchema),
  changePassword,
);
router.patch(
  "/avatar",
  verifyToken,
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "coverPhoto", maxCount: 1 },
  ]),
  validate(updateProfileSchema),
  updateProfilePhoto,
);

router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);

router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

router.get("/me", verifyToken, getProfile);

router.get("/:id", verifyToken, getUserById);
router.get("/", adminVerifyJWT, authorize("customers.view"), getAllUsers);
router.patch("/:id", adminVerifyJWT, authorize("customers.edit"), updateUserByAdmin);
router.delete("/:id", adminVerifyJWT, authorize("customers.delete"), deleteUser);
export default router;
