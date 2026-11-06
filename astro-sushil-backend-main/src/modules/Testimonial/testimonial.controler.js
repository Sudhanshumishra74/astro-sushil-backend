

import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { uploadFile ,deleteFile} from "../../service/UploadAws.js";
import { Testimonial } from "./testimonial.modal.js";
import { diffFields, logActivity } from "../AuditLog/auditLog.service.js";


export const createTestimonial = asyncHandler(async (req, res) => {
  const data = { ...req.validatedData };

  if (req.files?.image?.[0]) {
    const uploaded = await uploadFile({
      file: req.files.image[0],
      folder: "testimonials",
    });

    data.image = uploaded.url;
    data.imageKey = uploaded.key;
  }

  const item = await Testimonial.create(data);

  await logActivity({
    admin: req.user,
    action: "testimonial.create",
    targetType: "Testimonial",
    targetId: item._id,
    targetLabel: item?.name,
    changes: [],
  });

  res.json(new ApiResponse(201, item, "Created"));
});

export const getTestimonials = asyncHandler(async (req, res) => {
  const {
    page,
    serviceName,
    rating,
    isActive = true,
    limit = 10,
  } = req.query;

  const filter = {};

  if (page) filter.page = page;
  if (serviceName) filter.serviceName = serviceName;
  if (rating) filter.rating = { $gte: Number(rating) };
  if (isActive !== undefined) filter.isActive = isActive;

  const data = await Testimonial.find(filter)
    .sort({ order: 1, createdAt: -1 })
    .limit(Number(limit));

  res.json(
    new ApiResponse(200, {
      items: data,
      total: data.length,
    })
  );
});


export const getTestimonialById = asyncHandler(async (req, res) => {
  const item = await Testimonial.findById(req.params.id);

  if (!item) throw new ApiError(404, "Not found");

  res.json(new ApiResponse(200, item));
});
export const updateTestimonial = asyncHandler(async (req, res) => {
  const item = await Testimonial.findById(req.params.id);

  if (!item) {
    throw new ApiError(404, "Not found");
  }

  const updateData = req.validatedData || req.body;

  if (req.files?.image?.[0]) {
    if (item.imageKey) {
      await deleteFile(item.imageKey);
    }

    const uploaded = await uploadFile({
      file: req.files.image[0],
      folder: "testimonials",
    });

    updateData.image = uploaded.url;
    updateData.imageKey = uploaded.key;
  }

  const before = await Testimonial.findById(req.params.id).lean();

  const updated = await Testimonial.findByIdAndUpdate(
    req.params.id,
    updateData,
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  await logActivity({
    admin: req.user,
    action: "testimonial.update",
    targetType: "Testimonial",
    targetId: updated?._id || req.params.id,
    targetLabel: updated?.name ?? before?.name,
    changes: diffFields(before, updated?.toObject?.() ?? updated, Object.keys(req.body || {})),
    skipIfNoChanges: true,
  });

  res.json(new ApiResponse(200, updated, "Updated"));
});
export const deleteTestimonial = asyncHandler(async (req, res) => {
  const item = await Testimonial.findById(req.params.id);

  if (!item) throw new ApiError(404, "Not found");

  if (item.imageKey) await deleteFile(item.imageKey);

  const itemLabel = item?.name;
  const itemId = item._id;

  await item.deleteOne();

  await logActivity({
    admin: req.user,
    action: "testimonial.delete",
    targetType: "Testimonial",
    targetId: itemId,
    targetLabel: itemLabel,
    changes: [],
  });

  res.json(new ApiResponse(200, null, "Deleted"));
});


export const toggleTestimonial = asyncHandler(async (req, res) => {
  const item = await Testimonial.findById(req.params.id);

  if (!item) throw new ApiError(404, "Not found");

  const wasActive = item.isActive;

  item.isActive = !item.isActive;
  await item.save();

  await logActivity({
    admin: req.user,
    action: "testimonial.toggle_status",
    targetType: "Testimonial",
    targetId: item._id,
    targetLabel: item?.name,
    changes: diffFields({ isActive: wasActive }, { isActive: item.isActive }, ["isActive"]),
    skipIfNoChanges: true,
  });

  res.json(new ApiResponse(200, item));
});