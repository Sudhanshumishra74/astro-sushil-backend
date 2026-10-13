import express from "express";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import {
  createRoleSchema,
  updateRoleSchema,
  updateRoleStatusSchema,
} from "./role.validation.js";
import {
  getRoles,
  getRoleOptions,
  getRoleById,
  createRole,
  updateRole,
  updateRoleStatus,
  deleteRole,
} from "./role.controller.js";

const router = express.Router();

// Registered before "/:id" — otherwise "options" is parsed as an id.
router.get(
  "/options",
  adminVerifyJWT,
  authorize("roles.view", "staff.create", "staff.edit"),
  getRoleOptions,
);

router.get("/", adminVerifyJWT, authorize("roles.view"), getRoles);

router.post(
  "/",
  adminVerifyJWT,
  authorize("roles.create"),
  validate(createRoleSchema),
  createRole,
);

router.get("/:id", adminVerifyJWT, authorize("roles.view"), getRoleById);

router.put(
  "/:id",
  adminVerifyJWT,
  authorize("roles.edit"),
  validate(updateRoleSchema),
  updateRole,
);

router.patch(
  "/:id/status",
  adminVerifyJWT,
  authorize("roles.edit"),
  validate(updateRoleStatusSchema),
  updateRoleStatus,
);

router.delete("/:id", adminVerifyJWT, authorize("roles.delete"), deleteRole);

export default router;
