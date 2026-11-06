import slugify from "slugify";

import { categorySchemaZod } from "./category.validation.js";
import { Category } from "./category.modal.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { deleteFile, uploadFile } from "../../service/UploadAws.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { diffFields, logActivity } from "../AuditLog/auditLog.service.js";


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

  await logActivity({
    admin: req.user,
    action: "category.create",
    targetType: "Category",
    targetId: category._id,
    targetLabel: category.name,
    changes: [],
  });

  return res
    .status(201)
    .json(new ApiResponse(201, category, "Category created"));
});


async function buildCategoryQuery(req) {
  const { search = "", topLevel, parent, includeInactive } = req.query;

  const query = {
    name: { $regex: search, $options: "i" },
  };

  // Deactivating a category (`isActive: false`) was purely cosmetic before
  // this — every read query, including customer-facing browsing, ignored
  // it entirely. The admin category list still needs to see (and re-enable)
  // deactivated categories, so it opts in with `includeInactive=true`;
  // every other caller — customer browsing chief among them — now gets
  // deactivated categories excluded by default.
  if (includeInactive !== "true") {
    query.isActive = { $ne: false };
  }

  // Landing-page category cards only want roots (no subcategories mixed
  // in) — both flags read from the same `parent` field, never combined
  // since a category can't sensibly be both.
  if (topLevel === "true") {
    query.parent = null;
  } else if (parent) {
    query.parent = { $in: parent.split(",").filter(Boolean) };
  }

  return query;
}

export const getCategories = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, topLevel, parent } = req.query;

  const query = await buildCategoryQuery(req);
  const skip = (page - 1) * limit;

  // Admin's category list defaults to newest-first. Customer-facing browsing
  // (topLevel/parent card grids) wants the opposite — oldest-first, i.e.
  // creation order.
  const isBrowsing = topLevel === "true" || Boolean(parent);

  const [categories, total] = await Promise.all([
    Category.find(query)
      .populate("parent", "name")
      .sort({ createdAt: isBrowsing ? 1 : -1 })
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

// Admin-only, separate from getCategories above: same filter/sort/pagination
// surface via the shared buildCategoryQuery, but ignores the isActive
// default-exclusion via includeInactive so admins can see (and re-enable)
// deactivated categories too.
export const getAdminCategories = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const query = await buildCategoryQuery(req);
  const skip = (page - 1) * limit;

  const [categories, total] = await Promise.all([
    Category.find(query)
      .populate("parent", "name")
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean(),
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
  const categories = await Category.find({
    isActive: { $ne: false },
  }).lean();

  const map = {};

  categories.forEach((cat) => {
    map[cat._id] = { ...cat, children: [] };
  });

  // Guard against a corrupt/cyclic parent chain (bad manual edit, or a
  // self-referential sync payload) — without this, a cycle either vanishes
  // silently from the tree (neither node is ever a root, so both are
  // unreachable from the output) or, depending on shape, leaves a circular
  // reference that crashes JSON.stringify on the response. Anything whose
  // ancestor walk doesn't reach a null parent within the total category
  // count is treated as its own root instead, so it stays visible.
  const isCyclic = (id) => {
    let current = map[id];
    let steps = 0;
    const limit = categories.length + 1;
    while (current?.parent) {
      if (++steps > limit) return true;
      current = map[current.parent];
    }
    return false;
  };

  const roots = [];

  categories.forEach((cat) => {
    if (cat.parent && map[cat.parent] && !isCyclic(cat._id)) {
      map[cat.parent].children.push(map[cat._id]);
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

  const beforeSnapshot = category.toObject();

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

  await logActivity({
    admin: req.user,
    action: "category.update",
    targetType: "Category",
    targetId: category._id,
    targetLabel: category.name,
    changes: diffFields(beforeSnapshot, category.toObject(), [
      "name",
      "slug",
      "description",
      "parent",
      "image",
    ]),
    skipIfNoChanges: true,
  });

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

  const deletedName = category.name;
  const deletedId = category._id;

  await category.deleteOne();

  await logActivity({
    admin: req.user,
    action: "category.delete",
    targetType: "Category",
    targetId: deletedId,
    targetLabel: deletedName,
    changes: [],
  });

  return res.json(new ApiResponse(200, null, "Category deleted"));
});