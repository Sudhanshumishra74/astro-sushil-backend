import { deleteFile, uploadFile } from "../../service/UploadAws.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Course } from "./course.modal.js";
import { diffFields, logActivity } from "../AuditLog/auditLog.service.js";

export const generateSlug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const createCourse = asyncHandler(async (req, res) => {
  const data = { ...req.validatedData };

  let baseSlug = generateSlug(data.title);
  let slug = baseSlug;
  let count = 1;


  while (await Course.findOne({ slug })) {
    slug = `${baseSlug}-${count++}`;
  }

  data.slug = slug;


  data.metaTitle = data.metaTitle || data.title;
  data.metaDescription =
    data.metaDescription || data.shortDescription || data.title;

  if (req.files?.thumbnail?.[0]) {
    const uploaded = await uploadFile({
      file: req.files.thumbnail[0],
      folder: "courses",
    });

    data.thumbnail = uploaded.url;
    data.thumbnailKey = uploaded.key;
  }

  const course = await Course.create(data);

  await logActivity({
    admin: req.user,
    action: "course.create",
    targetType: "Course",
    targetId: course._id,
    targetLabel: course.title,
    changes: [],
  });

  res.json(new ApiResponse(201, course, "Course created"));
});

export const updateCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const course = await Course.findById(id);
  if (!course) throw new ApiError(404, "Course not found");

  const data = { ...req.validatedData };

  if (data.title && data.title !== course.title) {
    let baseSlug = generateSlug(data.title);
    let slug = baseSlug;
    let count = 1;

    // ✅ inline unique slug logic
    while (await Course.findOne({ slug, _id: { $ne: id } })) {
      slug = `${baseSlug}-${count++}`;
    }

    data.slug = slug;
  }

  // ✅ meta fallback
  if (data.metaTitle === undefined) {
    data.metaTitle = course.metaTitle || course.title;
  }

  if (data.metaDescription === undefined) {
    data.metaDescription =
      course.metaDescription ||
      course.shortDescription ||
      course.title;
  }

  if (req.files?.thumbnail?.[0]) {
    if (course.thumbnailKey) {
      await deleteFile(course.thumbnailKey);
    }

    const uploaded = await uploadFile({
      file: req.files.thumbnail[0],
      folder: "courses",
    });

    data.thumbnail = uploaded.url;
    data.thumbnailKey = uploaded.key;
  }

  const before = await Course.findById(id).lean();

  const updated = await Course.findByIdAndUpdate(id, data, {
    returnDocument: "after",
    runValidators: true,
  });

  await logActivity({
    admin: req.user,
    action: "course.update",
    targetType: "Course",
    targetId: updated?._id ?? id,
    targetLabel: updated?.title || before?.title,
    changes: diffFields(before, updated?.toObject?.() ?? updated, Object.keys(req.body)),
    skipIfNoChanges: true,
  });

  res.json(new ApiResponse(200, updated, "Course updated"));
});
export const getCourseBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const course = await Course.findOne({
    slug,
    status: "ACTIVE",
  });

  if (!course) throw new ApiError(404, "Course not found");

  res.json(new ApiResponse(200, course));
});
export const getCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({ status: "ACTIVE" }).sort({
    createdAt: -1,
  });

  res.json(new ApiResponse(200, courses));
});
export const getCourseById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const course = await Course.findById(id);

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  res.json(new ApiResponse(200, course));
});

export const deleteCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const course = await Course.findById(id);
  if (!course) throw new ApiError(404, "Not found");

  if (course.thumbnailKey) {
    await deleteFile(course.thumbnailKey);
  }

  const deletedTitle = course.title;
  const deletedId = course._id;

  await course.deleteOne();

  await logActivity({
    admin: req.user,
    action: "course.delete",
    targetType: "Course",
    targetId: deletedId,
    targetLabel: deletedTitle,
    changes: [],
  });

  res.json(new ApiResponse(200, {}, "Deleted"));
});
