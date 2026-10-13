import express from "express";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";
import { getPermissions } from "./permission.controller.js";

const router = express.Router();

// OR-gated: anyone who can view, create, or edit a role needs the checkbox
// matrix this endpoint powers.
router.get(
  "/",
  adminVerifyJWT,
  authorize("permissions.view", "roles.view", "roles.create", "roles.edit"),
  getPermissions,
);

export default router;
