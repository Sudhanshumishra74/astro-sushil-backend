import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  faqCreateSchema,
  faqUpdateSchema,
} from "./faq.validation.js";
import FAQ from "./faqs.model.js";

export const createFAQ = asyncHandler(async (req, res) => {
  const parsed = faqCreateSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0].message);
  }

  const faq = await FAQ.create({
    ...parsed.data,
    createdBy: req.user?._id,
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

  Object.assign(faq, parsed.data, {
    updatedBy: req.user?._id,
  });

  await faq.save();

  return res
    .status(200)
    .json(new ApiResponse(200, faq, "FAQ updated successfully"));
});

export const deleteFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.findById(req.params.id);

  if (!faq) {
    throw new ApiError(404, "FAQ not found");
  }

  await faq.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "FAQ deleted successfully"));
});
