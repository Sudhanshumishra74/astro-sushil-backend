
import express from "express";
import {
  submitContact,
  getContacts,
  getContactById,
  updateContactRemarks,
  deleteContact,
} from "./contact.controller.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";

const router = express.Router();

router.post("/", submitContact);

router.get("/", adminVerifyJWT, authorize("contacts.view"), getContacts);
router.get("/contact/:id", adminVerifyJWT, authorize("contacts.view"), getContactById);
router.patch("/contact/:id/remarks", adminVerifyJWT, authorize("contacts.edit"), updateContactRemarks);
router.delete("/contact/:id", adminVerifyJWT, authorize("contacts.delete"), deleteContact);

export default router;