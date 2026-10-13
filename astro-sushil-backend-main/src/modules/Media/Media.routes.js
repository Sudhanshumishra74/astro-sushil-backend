import express from "express";
import {
  createMedia,
  getMedia,
  getAllMediaAdmin,
  getMediaById,
  updateMedia,
  deleteMedia,
} from "./Media.controller.js";

import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";
import upload from "../../middlewares/multer.js";

const router = express.Router();

router.get("/", getMedia);

router.get("/admin", adminVerifyJWT, authorize("media.view"), getAllMediaAdmin);

router.get("/admin/:id", adminVerifyJWT, authorize("media.view"), getMediaById);

router.post(
  "/",
  adminVerifyJWT,
  authorize("media.create"),
  upload.fields([
    { name: "media", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  createMedia,
);

router.put(
  "/:id",
  adminVerifyJWT,
  authorize("media.edit"),
  upload.fields([
    { name: "media", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  updateMedia,
);

router.delete("/:id", adminVerifyJWT, authorize("media.delete"), deleteMedia);

export default router;
