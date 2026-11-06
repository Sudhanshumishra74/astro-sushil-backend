import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  faqCreateSchema,
  faqUpdateSchema,
} from "./faq.validation.js";
import FAQ from "./faqs.model.js";
import { diffFields, logActivity } from "../AuditLog/auditLog.service.js";

const FAQ_AUDIT_FIELDS = ["question", "answer", "page", "isActive", "order"];

export const createFAQ = asyncHandler(async (req, res) => {
  const parsed = faqCreateSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0].message);
  }

  const faq = await FAQ.create({
    ...parsed.data,
    createdBy: req.user?._id,
  });

  await logActivity({
    admin: req.user,
    action: "faq.create",
    targetType: "FAQ",
    targetId: faq._id,
    targetLabel: faq?.question,
    changes: [],
  });

  return res
    .status(201)
    .json(new ApiResponse(201, faq, "FAQ created successfully"));
});

export const getFAQs = asyncHandler(async (req, res) => {
  const { page } = req.query;

  const filter = {
    isActive: true,
    ...(page && { page }),
  };

  const faqs = await FAQ.find(filter).sort({ order: 1, createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, faqs, "FAQs fetched successfully"));
});

export const getAllFAQsAdmin = asyncHandler(async (req, res) => {
  const faqs = await FAQ.find().sort({ order: 1 });

  return res.status(200).json(new ApiResponse(200, faqs, "All FAQs fetched"));
});

export const updateFAQ = asyncHandler(async (req, res) => {
  const parsed = faqUpdateSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0].message);
  }

  const faq = await FAQ.findById(req.params.id);

  if (!faq) {
    throw new ApiError(404, "FAQ not found");
  }

  const beforeSnapshot = faq.toObject();

  Object.assign(faq, parsed.data, {
    updatedBy: req.user?._id,
  });

  await faq.save();

  await logActivity({
    admin: req.user,
    action: "faq.update",
    targetType: "FAQ",
    targetId: faq._id,
    targetLabel: faq?.question,
    changes: diffFields(beforeSnapshot, faq.toObject(), FAQ_AUDIT_FIELDS),
    skipIfNoChanges: true,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, faq, "FAQ updated successfully"));
});

export const deleteFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.findById(req.params.id);

  if (!faq) {
    throw new ApiError(404, "FAQ not found");
  }

  const faqLabel = faq?.question;
  const faqId = faq._id;

  await faq.deleteOne();

  await logActivity({
    admin: req.user,
    action: "faq.delete",
    targetType: "FAQ",
    targetId: faqId,
    targetLabel: faqLabel,
    changes: [],
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "FAQ deleted successfully"));
});
