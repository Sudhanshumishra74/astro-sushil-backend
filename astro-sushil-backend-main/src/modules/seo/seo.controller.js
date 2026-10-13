import { deleteFile, uploadFile } from "../../service/UploadAws.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import Seo from "./seo.modal.js";

const seoCache = new Map();

export const createNewPageSeo = asyncHandler(async (req, res) => {
  const body = { ...req.validatedData };

  body.name = body.name.toLowerCase();

  const exists = await Seo.findOne({ name: body.name }).lean();

  if (exists) {
    throw new ApiError(400, "SEO for this page already exists");
  }

  if (req.file) {
    const image = await uploadFile({ file: req.file });
    body.image = image;
  }

  const seo = await Seo.create(body);

  seoCache.delete(body.name);

  return res
    .status(201)
    .json(new ApiResponse(201, seo, "SEO created successfully"));
});

export const updatePageSeo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = { ...req.validatedData };

  if (body.name) {
    body.name = body.name.toLowerCase();
  }

  const seo = await Seo.findById(id).lean();

  if (!seo) {
    throw new ApiError(404, "SEO not found");
  }

  if (req.file) {
    if (seo.image?.publicId) {
      await deleteFile(seo.image.publicId);
    }

    const image = await uploadFile({
      file: req.file,
    });

    body.image = image;
  }

  const updated = await Seo.findByIdAndUpdate(id, body, {
    new: true,
    lean: true,
  });

  seoCache.delete(seo.name);

  if (updated?.name) {
    seoCache.delete(updated.name);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updated, "SEO updated successfully"));
});

export const getPageSeo = asyncHandler(async (req, res) => {
  const name = req.params.name.toLowerCase();

  if (seoCache.has(name)) {
    return res
      .status(200)
      .json(
        new ApiResponse(200, seoCache.get(name), "SEO fetched successfully"),
      );
  }

  const seo = await Seo.findOne({ name })
    .select(
      `
        name
        metaTitle
        metaDescription
        metaKeywords
        ogTitle
        ogDescription
        twitterTitle
        twitterDescription
        twitterImage
        image
      `,
    )
    .lean();

  if (!seo) {
    throw new ApiError(404, "SEO not found");
  }

  seoCache.set(name, seo);

  setTimeout(
    () => {
      seoCache.delete(name);
    },
    1000 * 60 * 10,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, seo, "SEO fetched successfully"));
});

export const getAllPageSeos = asyncHandler(async (req, res) => {
  const seos = await Seo.find().sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, seos, "All SEO fetched"));
});

export const deletePageSeo = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const seo = await Seo.findById(id);
  if (!seo) {
    throw new ApiError(404, "SEO not found");
  }

  if (seo.image?.publicId) {
    await deleteFile(seo.image.publicId);
  }

  await Seo.findByIdAndDelete(id);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "SEO deleted successfully"));
});
