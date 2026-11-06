import { Banner } from "./banner.modal.js";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { uploadFile, deleteFile } from "../../service/UploadAws.js";
import { getCache, setCache, delCache } from "../../utils/cache.js";
import { diffFields, logActivity } from "../AuditLog/auditLog.service.js";

// One key per page — deleted as a batch on any banner mutation.
const BANNER_CACHE_KEYS = [
  "banners:frontend:Homepage",
  "banners:frontend:About",
  "banners:frontend:Contact",
  "banners:frontend:Services",
];

async function invalidateBannerCache() {
  await delCache(...BANNER_CACHE_KEYS);
}

export const createBanner = asyncHandler(async (req, res) => {
  const data = { ...req.validatedData };

  if (req.files?.image?.[0]) {
    const uploaded = await uploadFile({
      file: req.files.image[0],
      folder: "banners",
    });

    data.image = uploaded.url;
    data.imageKey = uploaded.key;
  }

  const banner = await Banner.create(data);

  await invalidateBannerCache();

  await logActivity({
    admin: req.user,
    action: "banner.create",
    targetType: "Banner",
    targetId: banner._id,
    targetLabel: banner.title || banner.page || String(banner._id),
    changes: [],
  });

  res.json(new ApiResponse(201, banner, "Banner created successfully"));
});

export const getBanners = asyncHandler(async (req, res) => {
  const { page, type, isActive } = req.query;

  const filter = {};

  if (page) filter.page = page;
  if (type) filter.type = type;

  if (isActive !== undefined) {
    filter.isActive = isActive === "true";
  }

  const banners = await Banner.find(filter).sort({
    order: 1,
    createdAt: -1,
  });

  res.json(new ApiResponse(200, banners));
});

export const getBannerById = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);

  if (!banner) throw new ApiError(404, "Banner not found");

  res.json(new ApiResponse(200, banner));
});

export const updateBanner = asyncHandler(async (req, res) => {
  const bannerId = req.params.id;
  const updateData = { ...req.validatedData };

  const banner = await Banner.findById(bannerId);
  if (!banner) throw new ApiError(404, "Banner not found");

  const beforeSnapshot = banner.toObject();

  if (req.files?.image?.[0]) {
    if (banner.imageKey) {
      await deleteFile(banner.imageKey);
    }

    const uploaded = await uploadFile({
      file: req.files.image[0],
      folder: "banners",
    });

    updateData.image = uploaded.url;
    updateData.imageKey = uploaded.key;
  }

  const updated = await Banner.findByIdAndUpdate(bannerId, updateData, {
    returnDocument: "after",
    runValidators: true,
  });

  await invalidateBannerCache();

  await logActivity({
    admin: req.user,
    action: "banner.update",
    targetType: "Banner",
    targetId: banner._id,
    targetLabel: updated?.title || beforeSnapshot.title || String(banner._id),
    changes: diffFields(beforeSnapshot, updated?.toObject?.() ?? updated, Object.keys(updateData)),
    skipIfNoChanges: true,
  });

  res.json(new ApiResponse(200, updated, "Banner updated successfully"));
});

export const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);

  if (!banner) throw new ApiError(404, "Banner not found");

  if (banner.imageKey) {
    await deleteFile(banner.imageKey);
  }

  const deletedLabel = banner.title || banner.page || String(banner._id);
  const deletedId = banner._id;

  await banner.deleteOne();

  await invalidateBannerCache();

  await logActivity({
    admin: req.user,
    action: "banner.delete",
    targetType: "Banner",
    targetId: deletedId,
    targetLabel: deletedLabel,
    changes: [],
  });

  res.json(new ApiResponse(200, null, "Banner deleted successfully"));
});

export const toggleBannerStatus = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);

  if (!banner) throw new ApiError(404, "Banner not found");

  const wasActive = banner.isActive;

  banner.isActive = !banner.isActive;
  await banner.save();

  await invalidateBannerCache();

  await logActivity({
    admin: req.user,
    action: "banner.toggle_status",
    targetType: "Banner",
    targetId: banner._id,
    targetLabel: banner.title || banner.page || String(banner._id),
    changes: diffFields({ isActive: wasActive }, { isActive: banner.isActive }, ["isActive"]),
    skipIfNoChanges: true,
  });

  res.json(
    new ApiResponse(
      200,
      banner,
      `Banner ${banner.isActive ? "activated" : "deactivated"}`,
    ),
  );
});

export const getFrontendBanners = asyncHandler(async (req, res) => {
  let { page = "home" } = req.query;

  const pageMap = {
    home: "Homepage",
    about: "About",
    contact: "Contact",
    services: "Services",
  };

  const formattedPage = pageMap[page.toLowerCase()] || page;
  const cacheKey = `banners:frontend:${formattedPage}`;

  const cached = await getCache(cacheKey);
  if (cached) {
    return res.json(new ApiResponse(200, cached));
  }

  let data;

  if (formattedPage === "Homepage") {
    const sliders = await Banner.find(
      {
        page: "Homepage",
        type: "Slider",
        isActive: true,
      },
      {
        title: 1,
        subtitle: 1,
        description: 1,
        image: 1,
        buttons: 1,
        order: 1,
      }
    )
      .sort({ order: 1 })
      .lean();

    data = { sliders };
  } else {
    const banner = await Banner.findOne(
      {
        page: formattedPage,
        type: "Page",
        isActive: true,
      },
      {
        title: 1,
        subtitle: 1,
        description: 1,
        image: 1,
      }
    ).lean();

    data = { banner };
  }

  await setCache(cacheKey, data);

  return res.json(new ApiResponse(200, data));
});