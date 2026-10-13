import { deleteFile, uploadFile } from "../../service/UploadAws.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Blog } from "./Blog.model.js";

import { blogSchemaZod } from "./blog.validation.js";


const safeJSON = (value, fallback) => {
  try {
    if (!value) return fallback;
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
};


export const createBlog = asyncHandler(async (req, res) => {
  const body = {
    ...req.body,
    tags: safeJSON(req.body.tags, []),
    seo: safeJSON(req.body.seo, {}),
    author: safeJSON(req.body.author, {}),
  };

  const parsed = blogSchemaZod.safeParse(body);

  if (!parsed.success) {
    throw new ApiError(
      400,
      "Validation failed",
      (parsed.error?.issues || []).map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }))
    );
  }

  let images = [];
  let thumbnail = null;

  if (req.files?.images) {
    for (const file of req.files.images) {
      const uploaded = await uploadFile({ file });
      images.push({ url: uploaded.url, key: uploaded.key });
    }
  }

  if (req.files?.thumbnail?.[0]) {
    const uploaded = await uploadFile({ file: req.files.thumbnail[0] });
    thumbnail = { url: uploaded.url, key: uploaded.key };
  }

  const blog = await Blog.create({
    ...parsed.data,
    images,
    thumbnail,
    publishedAt:
      parsed.data.status === "published" ? new Date() : null,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, blog, "Blog created"));
});


export const updateBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);

  if (!blog) throw new ApiError(404, "Blog not found");

  const body = {
    ...req.body,
    tags: safeJSON(req.body.tags, blog.tags),
    seo: safeJSON(req.body.seo, blog.seo),
    author: safeJSON(req.body.author, blog.author),
  };

  const parsed = blogSchemaZod.partial().safeParse(body);

  if (!parsed.success) {
    throw new ApiError(
      400,
      "Validation failed",
      (parsed.error?.errors || []).map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }))
    );
  }

  // IMAGES
  if (req.files?.images?.length) {
    if (blog.images?.length) {
      for (const img of blog.images) {
        if (img.key) await deleteFile(img.key);
      }
    }

    const images = [];

    for (const file of req.files.images) {
      const uploaded = await uploadFile({ file });
      images.push({ url: uploaded.url, key: uploaded.key });
    }

    parsed.data.images = images;
  }

  // THUMBNAIL
  if (req.files?.thumbnail?.[0]) {
    if (blog.thumbnail?.key) {
      await deleteFile(blog.thumbnail.key);
    }

    const uploaded = await uploadFile({ file: req.files.thumbnail[0] });

    parsed.data.thumbnail = {
      url: uploaded.url,
      key: uploaded.key,
    };
  }

  Object.assign(blog, parsed.data);

  if (parsed.data.status === "published" && !blog.publishedAt) {
    blog.publishedAt = new Date();
  }

  await blog.save();

  return res.json(new ApiResponse(200, blog, "Blog updated"));
});


export const getBlogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = "" } = req.query;

  const query = {
    title: { $regex: search, $options: "i" },
  };

  const blogs = await Blog.find(query)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .sort({ createdAt: -1 });

  const total = await Blog.countDocuments(query);

  return res.json(
    new ApiResponse(200, { blogs, total }, "Blogs fetched")
  );
});


export const getBlogById = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);

  if (!blog) throw new ApiError(404, "Blog not found");

  blog.views += 1;
  await blog.save();

  return res.json(new ApiResponse(200, blog, "Blog fetched"));
});


export const deleteBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);

  if (!blog) throw new ApiError(404, "Blog not found");

  if (blog.images?.length) {
    for (const img of blog.images) {
      if (img.key) await deleteFile(img.key);
    }
  }

  if (blog.thumbnail?.key) {
    await deleteFile(blog.thumbnail.key);
  }

  await blog.deleteOne();

  return res.json(new ApiResponse(200, null, "Blog deleted"));
});


export const getBlogBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const blog = await Blog.findOne({ slug });

  if (!blog) throw new ApiError(404, "Blog not found");

  blog.views += 1;
  await blog.save();

  return res.json(new ApiResponse(200, blog, "Blog fetched"));
});