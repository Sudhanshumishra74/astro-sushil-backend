

import express from "express";
import { downloadFile, getMyDownloads } from "./download.controller.js";
import { verifyToken } from "../../middlewares/verifyToken.js";




const router = express.Router();

router.use(verifyToken);

router.get("/my-downloads", getMyDownloads);

router.get("/:id", downloadFile);

export default router;