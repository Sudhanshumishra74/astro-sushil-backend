

import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { uploadFile ,deleteFile} from "../../service/UploadAws.js";
import { Testimonial } from "./testimonial.modal.js";


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

  const updated = await Testimonial.findByIdAndUpdate(
    req.params.id,
    updateData,
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  res.json(new ApiResponse(200, updated, "Updated"));
});
export const deleteTestimonial = asyncHandler(async (req, res) => {
  const item = await Testimonial.findById(req.params.id);

  if (!item) throw new ApiError(404, "Not found");

  if (item.imageKey) await deleteFile(item.imageKey);

  await item.deleteOne();

  res.json(new ApiResponse(200, null, "Deleted"));
});


export const toggleTestimonial = asyncHandler(async (req, res) => {
  const item = await Testimonial.findById(req.params.id);

  if (!item) throw new ApiError(404, "Not found");

  item.isActive = !item.isActive;
  await item.save();

  res.json(new ApiResponse(200, item));
});