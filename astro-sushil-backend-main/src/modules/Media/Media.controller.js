import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";

import { createMediaSchema, updateMediaSchema } from "./Media.validation.js";

import { Media } from "./Media.model.js";

import { deleteFile, uploadFile } from "../../service/UploadAws.js";

export const createMedia = asyncHandler(async (req, res) => {
  const payload = {
    title: req.body.title ? String(req.body.title) : undefined,

    description: req.body.description
      ? String(req.body.description)
      : undefined,

    section: req.body.section ? String(req.body.section) : undefined,

    mediaUrl: req.body.mediaUrl ? String(req.body.mediaUrl) : undefined,

    tag: req.body.tag ? String(req.body.tag) : undefined,

    personName: req.body.personName ? String(req.body.personName) : undefined,

    background: req.body.background ? String(req.body.background) : undefined,

    isActive:
      req.body.isActive !== undefined ? req.body.isActive === "true" : true,

    order: req.body.order !== undefined ? Number(req.body.order) : undefined,
  };

  const parsed = createMediaSchema.safeParse(payload);

  if (!parsed.success) {
    console.log(parsed.error.issues);

    throw new ApiError(400, parsed.error.issues[0].message);
  }

  const data = parsed.data;

  if (data.section === "wishes") {
    data.type = "image";

    if (!req.files?.media?.length) {
      throw new ApiError(400, "Image is required for wishes");
    }

    const uploaded = await uploadFile({
      file: req.files.media[0],
    });

   data.thumbnail = uploaded.url;
data.thumbnailKey = uploaded.key;
  }

  if (data.section === "celebrity") {
    data.type = "video";

    if (!req.files?.media?.length) {
      throw new ApiError(400, "Video upload is required");
    }

    if (!req.files?.thumbnail?.length) {
      throw new ApiError(400, "Thumbnail is required");
    }

    const uploadedVideo = await uploadFile({
      file: req.files.media[0],
    });

    data.mediaUrl = uploadedVideo.url;
    data.mediaKey = uploadedVideo.key;

    const uploadedThumb = await uploadFile({
      file: req.files.thumbnail[0],
    });

    data.thumbnail = uploadedThumb.url;
    data.thumbnailKey = uploadedThumb.key;
  }

  if (data.section === "podcast") {
    data.type = "video";

    if (req.files?.media?.length) {
      throw new ApiError(400, "Podcast only supports Youtube URL");
    }

    if (req.files?.thumbnail?.length) {
      const uploadedThumb = await uploadFile({
        file: req.files.thumbnail[0],
      });

      data.thumbnail = uploadedThumb.url;
      data.thumbnailKey = uploadedThumb.key;
    }

    if (!data.thumbnail && data.mediaUrl) {
      const match = data.mediaUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);

      if (match) {
        data.thumbnail = `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
      }
    }
  }

  const media = await Media.create({
    ...data,
    createdBy: req.user?._id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, media, "Media created successfully"));
});

export const updateMedia = asyncHandler(async (req, res) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    throw new ApiError(404, "Media not found");
  }

  const payload = {
    title:
      req.body.title !== undefined
        ? String(req.body.title)
        : media.title,

    description:
      req.body.description !== undefined
        ? String(req.body.description)
        : media.description,

    section:
      req.body.section !== undefined
        ? String(req.body.section)
        : media.section,

    mediaUrl:
      req.body.mediaUrl !== undefined
        ? String(req.body.mediaUrl)
        : media.mediaUrl,

    tag:
      req.body.tag !== undefined
        ? String(req.body.tag)
        : media.tag,

    personName:
      req.body.personName !== undefined
        ? String(req.body.personName)
        : media.personName,

    background:
      req.body.background !== undefined
        ? String(req.body.background)
        : media.background,

    isActive:
      req.body.isActive !== undefined
        ? req.body.isActive === "true"
        : media.isActive,

    order:
      req.body.order !== undefined
        ? Number(req.body.order)
        : media.order,
  };

  const parsed = updateMediaSchema.safeParse(payload);

  if (!parsed.success) {
    console.log(parsed.error.issues);

    throw new ApiError(400, parsed.error.issues[0].message);
  }

  const data = parsed.data;

  // ── Wishes ────────────────────────
  if (data.section === "wishes") {
    data.type = "image";

    if (req.files?.media?.length) {
      if (media.mediaKey) {
        await deleteFile(media.mediaKey);
      }

      const uploaded = await uploadFile({
        file: req.files.media[0],
      });

     data.thumbnail = uploaded.url;
data.thumbnailKey = uploaded.key;
    }
  }

  // ── Celebrity ─────────────────────
  if (data.section === "celebrity") {
    data.type = "video";

    if (req.files?.media?.length) {
      if (media.mediaKey) {
        await deleteFile(media.mediaKey);
      }

      const uploadedVideo = await uploadFile({
        file: req.files.media[0],
      });

      data.mediaUrl = uploadedVideo.url;
      data.mediaKey = uploadedVideo.key;
    }

    if (req.files?.thumbnail?.length) {
      if (media.thumbnailKey) {
        await deleteFile(media.thumbnailKey);
      }

      const uploadedThumb = await uploadFile({
        file: req.files.thumbnail[0],
      });

      data.thumbnail = uploadedThumb.url;
      data.thumbnailKey = uploadedThumb.key;
    }
  }

  // ── Podcast ───────────────────
  if (data.section === "podcast") {
    data.type = "video";

    if (req.files?.media?.length) {
      throw new ApiError(
        400,
        "Podcast only supports Youtube URL",
      );
    }

    if (req.files?.thumbnail?.length) {
      if (media.thumbnailKey) {
        await deleteFile(media.thumbnailKey);
      }

      const uploadedThumb = await uploadFile({
        file: req.files.thumbnail[0],
      });

      data.thumbnail = uploadedThumb.url;
      data.thumbnailKey = uploadedThumb.key;
    }

    if (!data.thumbnail && data.mediaUrl) {
      const match = data.mediaUrl.match(
        /(?:v=|\/)([0-9A-Za-z_-]{11})/,
      );

      if (match) {
        data.thumbnail = `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
      }
    }
  }

  Object.assign(media, data, {
    updatedBy: req.user?._id,
  });

  await media.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        media,
        "Media updated successfully",
      ),
    );
});
export const deleteMedia = asyncHandler(async (req, res) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    throw new ApiError(404, "Media not found");
  }

  // 🔥 delete files from S3
  if (media.mediaKey) {
    await deleteFile(media.mediaKey);
  }

  if (media.thumbnailKey) {
    await deleteFile(media.thumbnailKey);
  }

  await media.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Media deleted successfully"));
});

export const getMedia = asyncHandler(async (req, res) => {
  const { section } = req.query;

  const filter = {
    isActive: true,
    ...(section && { section }),
  };

  const items = await Media.find(filter).sort({
    order: 1,
    createdAt: -1,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, items, "Media fetched successfully"));
});

export const getAllMediaAdmin = asyncHandler(async (req, res) => {
  const items = await Media.find().sort({ order: 1 });

  return res.status(200).json(new ApiResponse(200, items, "All media fetched"));
});

export const getMediaById = asyncHandler(async (req, res) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    throw new ApiError(404, "Media not found");
  }

  return res.status(200).json(new ApiResponse(200, media, "Media fetched"));
});
