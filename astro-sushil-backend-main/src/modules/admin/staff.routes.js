import express from "express";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import {
  createStaffSchema,
  updateStaffSchema,
  updateStaffRoleSchema,
  updateStaffStatusSchema,
  resetStaffPasswordSchema,
} from "./staff.validation.js";
import {
  getStaff,
  getStaffById,
  createStaff,
  updateStaff,
  updateStaffRole,
  updateStaffStatus,
  resetStaffPassword,
  deleteStaff,
} from "./staff.controller.js";

const router = express.Router();

router.get("/", adminVerifyJWT, authorize("staff.view"), getStaff);

router.post(
  "/",
  adminVerifyJWT,
  authorize("staff.create"),
  validate(createStaffSchema),
  createStaff,
);

router.get("/:id", adminVerifyJWT, authorize("staff.view"), getStaffById);

router.patch(
  "/:id",
  adminVerifyJWT,
  authorize("staff.edit"),
  validate(updateStaffSchema),
  updateStaff,
);

router.patch(
  "/:id/role",
  adminVerifyJWT,
  authorize("staff.edit"),
  validate(updateStaffRoleSchema),
  updateStaffRole,
);

router.patch(
  "/:id/status",
  adminVerifyJWT,
  authorize("staff.edit"),
  validate(updateStaffStatusSchema),
  updateStaffStatus,
);

router.post(
  "/:id/reset-password",
  adminVerifyJWT,
  authorize("staff.edit"),
  validate(resetStaffPasswordSchema),
  resetStaffPassword,
);

router.delete("/:id", adminVerifyJWT, authorize("staff.delete"), deleteStaff);

export default router;
