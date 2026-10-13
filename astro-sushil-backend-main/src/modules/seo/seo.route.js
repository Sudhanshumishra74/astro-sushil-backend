import { Router } from "express";
import {
  createNewPageSeo,
  deletePageSeo,
  getAllPageSeos,
  getPageSeo,
  updatePageSeo,
} from "./seo.controller.js";
import upload from "../../middlewares/multer.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import { createSeo, updateSeo } from "./seo.validation.js";

const seoRouter = Router();

seoRouter.get("/:name", getPageSeo);
seoRouter.get("/", adminVerifyJWT, authorize("seo.view"), getAllPageSeos);
seoRouter.post(
  "/",
  adminVerifyJWT,
  authorize("seo.create"),
  upload.single("file"),
  validate(createSeo),
  createNewPageSeo,
);
seoRouter.put(
  "/:id",
  adminVerifyJWT,
  authorize("seo.edit"),
  upload.single("file"),
  validate(updateSeo),
  updatePageSeo,
);
seoRouter.delete("/:id", adminVerifyJWT, authorize("seo.delete"), deletePageSeo);

export default seoRouter;
