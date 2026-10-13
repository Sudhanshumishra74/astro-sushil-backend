import slugify from "slugify";

import { categorySchemaZod } from "./category.validation.js";
import { Category } from "./category.modal.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { deleteFile, uploadFile } from "../../service/UploadAws.js";
import { ApiResponse } from "../../utils/ApiResponse.js";


const generateUniqueSlug = async (name) => {
  let baseSlug = slugify(name, { lower: true, strict: true });
  let slug = baseSlug;
  let count = 1;

  while (await Category.findOne({ slug })) {
    slug = `${baseSlug}-${count++}`;
  }

  return slug;
};


export const createCategory = asyncHandler(async (req, res) => {
  const parsed = categorySchemaZod.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Validation failed", parsed.error.issues);
  }

  const { name, parent, description } = parsed.data;

  const slug = await generateUniqueSlug(name);

  let image = null;

  if (req.file) {
    image = await uploadFile({ file: req.file });
  }

  const category = await Category.create({
    name,
    slug,
    description,
    parent: parent || null,
    image,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, category, "Category created"));
});


export const getCategories = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
  } = req.query;

  const query = {
    name: { $regex: search, $options: "i" },
  };

  const skip = (page - 1) * limit;

  const [categories, total] = await Promise.all([
    Category.find(query)
      .populate("parent", "name")
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit)),
    Category.countDocuments(query),
  ]);

  return res.json(
    new ApiResponse(200, categories, "Categories fetched", {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    })
  );
});


export const getCategoryTree = asyncHandler(async (req, res) => {
  const categories = await Category.find().lean();

  const map = {};
  const roots = [];

  categories.forEach((cat) => {
    map[cat._id] = { ...cat, children: [] };
  });

  categories.forEach((cat) => {
    if (cat.parent) {
      map[cat.parent]?.children.push(map[cat._id]);
    } else {
      roots.push(map[cat._id]);
    }
  });

  return res.json(new ApiResponse(200, roots));
});


export const getCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id).populate(
    "parent",
    "name"
  );

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  return res.json(new ApiResponse(200, category));
});


export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  const parsed = categorySchemaZod.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Validation failed", parsed.error.issues);
  }

  const { name, parent, description } = parsed.data;

  if (name && name !== category.name) {
    category.name = name;
    category.slug = await generateUniqueSlug(name);
  }

  if (description !== undefined) {
    category.description = description;
  }

  if (parent !== undefined) {
    if (parent === category._id.toString()) {
      throw new ApiError(400, "Category cannot be its own parent");
    }
    category.parent = parent || null;
  }


  if (req.file) {
    if (category.image?.key) {
      await deleteFile(category.image.key);
    }

    const uploaded = await uploadFile({ file: req.file });
    category.image = uploaded;
  }

  await category.save();

  return res.json(new ApiResponse(200, category, "Category updated"));
});


export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  
  const hasChildren = await Category.findOne({ parent: category._id });
  if (hasChildren) {
    throw new ApiError(400, "Cannot delete category with subcategories");
  }

  if (category.image?.key) {
    await deleteFile(category.image.key);
  }

  await category.deleteOne();

  return res.json(new ApiResponse(200, null, "Category deleted"));
});