import mongoose from "mongoose";
import {
  productSchemaZod,
  productUpdateSchemaZod,
  productStatusSchemaZod,
} from "./product.validatin.js";
import { uploadFile, deleteFile } from "../../service/UploadAws.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import Cart from "../cart/cart.modal.js";
import Wishlist from "../wishlist/wishlist.modal.js";
import { createWatermarkedImage } from "../../utils/createWatermarkedImage.js";
import { Product } from "./product.modal.js";
import { Category } from "../category/category.modal.js";
import { diffFields, logActivity } from "../AuditLog/auditLog.service.js";

const safeJSON = (value, fallback) => {
  try {
    if (!value) return fallback;
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
};

// The admin form stamps a client-side uuidv4() onto every brand-new
// variant/sub-variant purely as a React key / file-input-ref key — it's
// never a real Mongo id. Passing that string straight through to Mongoose
// (now that Zod's variantSchema declares `_id`, see product.validatin.js)
// makes it try to cast a 36-char UUID to ObjectId and throw. Existing rows
// keep their real ObjectId `_id` untouched here; anything else gets its
// `_id` dropped so Mongoose assigns a fresh, real one on save.
const sanitizeVariantIds = (variants = []) =>
  variants.map((v) => {
    const variant = { ...v };

    if (variant._id != null && !mongoose.Types.ObjectId.isValid(variant._id)) {
      delete variant._id;
    }

    if (Array.isArray(variant.subVariants)) {
      variant.subVariants = variant.subVariants.map((sv) => {
        const subVariant = { ...sv };

        if (subVariant._id != null && !mongoose.Types.ObjectId.isValid(subVariant._id)) {
          delete subVariant._id;
        }

        return subVariant;
      });
    }

    return variant;
  });

// Same reasoning as sanitizeVariantIds above — certificates get a
// client-side uuidv4() React key too (see Addproduct.jsx's
// CertificatesEditor), which must not reach Mongoose as an `_id`.
const sanitizeCertificateIds = (certificates = []) =>
  certificates.map((c) => {
    const certificate = { ...c };

    if (certificate._id != null && !mongoose.Types.ObjectId.isValid(certificate._id)) {
      delete certificate._id;
    }

    return certificate;
  });

// Top-level scalar fields worth an audit-log entry on their own — deliberately
// excludes things like `images`/`description` (noisy, not the kind of change
// admins ask "who did this" about) and `variants` itself (handled separately
// below, since variant price/stock changes are the actual "price change" case
// staff activity tracking cares about, not the array reference changing).
const PRODUCT_AUDIT_FIELDS = [
  "name",
  "mrp",
  "discountType",
  "discountValue",
  "sku",
  "stock",
  "isPublished",
  "isFeatured",
  "weight",
  "soldByRatti",
  "pricePerRatti",
  "minRatti",
  "maxRatti",
];

function diffProductChanges(before, after) {
  const changes = diffFields(before, after, PRODUCT_AUDIT_FIELDS);

  const beforeVariants = before.variants || [];

  for (const av of after.variants || []) {
    const bv = beforeVariants.find((v) => String(v._id) === String(av._id));
    if (!bv) continue; // brand-new variant — nothing to diff against

    const label = av.name && av.value ? `${av.name}: ${av.value}` : av.name || String(av._id);

    for (const field of ["mrp", "price", "stock"]) {
      if (bv[field] !== av[field]) {
        changes.push({ field: `variant[${label}].${field}`, from: bv[field] ?? null, to: av[field] ?? null });
      }
    }
  }

  return changes;
}

export const createProduct = asyncHandler(async (req, res) => {
  let images = [];
  let thumbnail = null;
  let videos = [];

  const isDigital = req.body.type === "digital";

  // ✅ 1. Parse variants ONCE
  let variants = safeJSON(req.body.variants, []);
  const variantFiles = req.files?.variantFiles || [];

  // ✅ 2. Attach files to variants
  if (variantFiles.length > 0) {
    for (let i = 0; i < variants.length; i++) {
      const file = variantFiles[i];
      if (!file) continue;

      const uploaded = await uploadFile({ file });

      // ✅ IMPORTANT: now stored in variant schema
      variants[i].downloadableFile = uploaded.url;
    }
  }

  variants = sanitizeVariantIds(variants);

  // ✅ 3. Build body (FIXED: use updated variants)
  const body = {
    ...req.body,

    hasVariants:
      req.body.hasVariants === "true" || req.body.hasVariants === true,

    soldByRatti:
      req.body.soldByRatti === "true" || req.body.soldByRatti === true,

    discountValue: Number(req.body.discountValue || 0),

    discountType: req.body.discountType || "percentage",

    variants, // ✅ FIX: use enriched variants

    certificates: sanitizeCertificateIds(safeJSON(req.body.certificates, [])),

    keywords: safeJSON(req.body.keywords, []),

    outOfStockRattis: safeJSON(req.body.outOfStockRattis, []),

    dimensions: safeJSON(req.body.dimensions),

    gst: safeJSON(req.body.gst, undefined),
  };

  // ✅ 4. Validate
  const parsed = productSchemaZod.safeParse(body);

  if (!parsed.success) {
    throw new ApiError(
      400,
      "Validation failed",
      parsed.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    );
  }

  // ✅ 5. Upload images
  const imageFiles = req.files?.images || [];

  for (const file of imageFiles) {
    let uploadTarget = file;

    if (isDigital) {
      const watermarkedBuffer = await createWatermarkedImage(file);

      uploadTarget = {
        ...file,
        buffer: watermarkedBuffer,
      };
    }

    const uploaded = await uploadFile({
      file: uploadTarget,
    });

    images.push(uploaded.url);
  }

  // ✅ 6. Upload thumbnail
  if (req.files?.thumbnail?.[0]) {
    let thumbFile = req.files.thumbnail[0];

    if (isDigital) {
      const watermarkedBuffer = await createWatermarkedImage(thumbFile);

      thumbFile = {
        ...thumbFile,
        buffer: watermarkedBuffer,
      };
    }

    const uploaded = await uploadFile({
      file: thumbFile,
    });

    thumbnail = uploaded.url;
  }

  // ✅ 6b. Upload videos (up to 2) — never watermarked/re-encoded (uploadFile
  // only touches image/* mimetypes), just stored as-is like a document
  // upload. The route's multer maxCount already caps this at 2, the slice
  // here is just belt-and-suspenders.
  for (const file of (req.files?.videos || []).slice(0, 2)) {
    const uploaded = await uploadFile({ file });
    videos.push(uploaded.url);
  }

  // ✅ 7. Create product
  const product = await Product.create({
    ...parsed.data,
    images,
    thumbnail,
    videos,
  });

  await logActivity({
    admin: req.user,
    action: "product.create",
    targetType: "Product",
    targetId: product._id,
    targetLabel: product?.name,
    changes: [],
  });

  return res.status(201).json(new ApiResponse(201, product, "Product created"));
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  const isDigital = (req.body.type || product.type) === "digital";

  let incomingVariants =
    req.body.variants !== undefined
      ? safeJSON(req.body.variants, [])
      : product.variants;

  const variantFiles = req.files?.variantFiles || [];

  const variantFileIds = Array.isArray(req.body.variantFileIds)
    ? req.body.variantFileIds
    : [req.body.variantFileIds];

  for (let i = 0; i < variantFiles.length; i++) {
    const file = variantFiles[i];
    const variantId = variantFileIds[i];

    if (!file || !variantId) continue;

    const variant = incomingVariants.find(
      (v) =>
        String(v._id) === String(variantId) ||
        String(v.id) === String(variantId),
    );

    if (!variant) continue;

    const uploaded = await uploadFile({ file });

    // delete old file if replacing
    if (variant.downloadableFile) {
      const key = variant.downloadableFile.split(".amazonaws.com/")[1];

      if (key) await deleteFile(key);
    }

    variant.downloadableFile = uploaded.url;
  }

  const incomingVariantsMap = new Map(
    incomingVariants.map((variant) => [
      String(variant._id || variant.id || ""),
      variant,
    ]),
  );

  const existingVariants = product.variants || [];

  const existingVariantIds = new Set(
    existingVariants.map((existing) => String(existing._id)),
  );

  const mergedVariants = await Promise.all(
    existingVariants.map(async (existing) => {
      const updated = incomingVariantsMap.get(String(existing._id));

      if (!updated) return existing;

      // `updated.downloadableFile` is only `undefined` here when the field
      // genuinely wasn't sent (variant untouched) — a File upload was
      // already resolved into a URL string by the loop above, and an
      // explicit removal (the admin's "Remove" button) arrives as `null`.
      // The old `updated.downloadableFile || existing.downloadableFile`
      // treated that `null` the same as "not sent," so a removed file
      // silently reverted to the previous one on every save — there was no
      // way to actually delete a digital variant's file once uploaded.
      const clearingFile =
        updated.downloadableFile === null && existing.downloadableFile;

      if (clearingFile) {
        const key = existing.downloadableFile.split(".amazonaws.com/")[1];
        if (key) await deleteFile(key);
      }

      return {
        ...(existing.toObject?.() || existing),
        ...updated,
        downloadableFile:
          updated.downloadableFile !== undefined
            ? updated.downloadableFile || null
            : existing.downloadableFile,
      };
    }),
  );

  const newVariants = incomingVariants.filter((variant) => {
    const variantKey = String(variant._id || variant.id || "");
    return !existingVariantIds.has(variantKey);
  });

  const body = {
    ...req.body,

    hasVariants:
      req.body.hasVariants === "true" || req.body.hasVariants === true,

    soldByRatti:
      req.body.soldByRatti === "true" || req.body.soldByRatti === true,

    isFeatured: req.body.isFeatured === "true" || req.body.isFeatured === true,

    isTrending: req.body.isTrending === "true" || req.body.isTrending === true,

    isBestSeller:
      req.body.isBestSeller === "true" || req.body.isBestSeller === true,

    isPublished:
      req.body.isPublished === "true" || req.body.isPublished === true,

    variants: sanitizeVariantIds([...mergedVariants, ...newVariants]),

    certificates:
      req.body.certificates !== undefined
        ? sanitizeCertificateIds(safeJSON(req.body.certificates, []))
        : product.certificates,

    keywords:
      req.body.keywords !== undefined
        ? safeJSON(req.body.keywords, [])
        : product.keywords,

    outOfStockRattis:
      req.body.outOfStockRattis !== undefined
        ? safeJSON(req.body.outOfStockRattis, [])
        : product.outOfStockRattis,

    dimensions:
      req.body.dimensions !== undefined
        ? safeJSON(req.body.dimensions, {})
        : product.dimensions,

    gst:
      req.body.gst !== undefined
        ? safeJSON(req.body.gst, undefined)
        : undefined,
  };

  const parsed = productUpdateSchemaZod.safeParse(body);

  if (!parsed.success) {
    throw new ApiError(
      400,
      "Validation failed",
      parsed.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    );
  }

  if (req.files?.images?.length) {
    if (product.images?.length) {
      for (const img of product.images) {
        const key =
          typeof img === "string" ? img.split(".amazonaws.com/")[1] : img?.key;

        if (key) await deleteFile(key);
      }
    }

    const images = [];

    for (const file of req.files.images) {
      let uploadTarget = file;

      if (isDigital) {
        const watermarkedBuffer = await createWatermarkedImage(file);

        uploadTarget = {
          ...file,
          buffer: watermarkedBuffer,
        };
      }

      const uploaded = await uploadFile({ file: uploadTarget });
      images.push(uploaded.url);
    }

    parsed.data.images = images;
  }

  if (req.files?.thumbnail?.[0]) {
    if (product.thumbnail) {
      const key =
        typeof product.thumbnail === "string"
          ? product.thumbnail.split(".amazonaws.com/")[1]
          : product.thumbnail?.key;

      if (key) await deleteFile(key);
    }

    let thumbFile = req.files.thumbnail[0];

    if (isDigital) {
      const watermarkedBuffer = await createWatermarkedImage(thumbFile);

      thumbFile = {
        ...thumbFile,
        buffer: watermarkedBuffer,
      };
    }

    const uploaded = await uploadFile({ file: thumbFile });

    parsed.data.thumbnail = uploaded.url;
  }

  // Never watermarked/re-encoded (uploadFile only touches image/* mimetypes).
  // Unlike `images` (which is always fully replaced whenever any new file
  // comes in), videos support keeping one of the up-to-2 existing ones while
  // adding/replacing the other — `existingVideos` is a JSON array of the
  // existing URLs the admin chose to keep. Addproduct.jsx always sends it
  // (even when nothing changed, or as an empty array to mean "remove
  // both"), since plain field omission can't be told apart from "untouched"
  // server-side; resending the unchanged list is a no-op below (every old
  // url is still in keepUrls, so nothing gets deleted or re-uploaded).
  if (req.files?.videos?.length || req.body.existingVideos !== undefined) {
    const keepUrls = safeJSON(req.body.existingVideos, []);

    for (const oldUrl of product.videos || []) {
      if (keepUrls.includes(oldUrl)) continue;

      const key =
        typeof oldUrl === "string" ? oldUrl.split(".amazonaws.com/")[1] : oldUrl?.key;

      if (key) await deleteFile(key);
    }

    const uploadedUrls = [];

    for (const file of (req.files?.videos || []).slice(0, 2)) {
      const uploaded = await uploadFile({ file });
      uploadedUrls.push(uploaded.url);
    }

    parsed.data.videos = [...keepUrls, ...uploadedUrls].slice(0, 2);
  }

  const beforeSnapshot = product.toObject();

  Object.assign(product, parsed.data);

  await product.save();

  await logActivity({
    admin: req.user,
    action: "product.update",
    targetType: "Product",
    targetId: product._id,
    targetLabel: product.name,
    changes: diffProductChanges(beforeSnapshot, product.toObject()),
    skipIfNoChanges: true,
  });

  return res.json(new ApiResponse(200, product, "Product updated"));
});

// Categories can nest (e.g. "Gemstone" -> "Emerald", "Citrine", ...) and
// products are generally assigned to a leaf category, not the parent — so
// filtering by a parent needs to pull in every descendant too, or browsing
// "Gemstone" would return nothing despite it having products once you count
// its children.
async function getCategoryAndDescendantIds(rootId) {
  const all = await Category.find({}).select("_id parent").lean();

  const childrenByParent = new Map();
  for (const c of all) {
    const key = c.parent ? String(c.parent) : null;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(String(c._id));
  }

  const ids = [String(rootId)];
  const visited = new Set(ids);
  const queue = [String(rootId)];

  // `visited` is the load-bearing part here, not just a de-dupe nicety — a
  // corrupt/cyclic parent chain (bad manual edit) would otherwise queue the
  // same node forever and hang the request.
  while (queue.length) {
    const current = queue.shift();
    for (const childId of childrenByParent.get(current) || []) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      ids.push(childId);
      queue.push(childId);
    }
  }

  return ids;
}

// Builds the shared Mongo filter for the product listing from one unified
// query-param surface (q, category/categoryUuid, inStock,
// minPrice/maxPrice, minWeight/maxWeight, type).
async function buildProductQuery(req, { adminMode = false } = {}) {
  const search = req.query.q || req.query.search || "";

  const query = {
    name: { $regex: search, $options: "i" },
  };

  // The public/customer listing only ever shows published products. The
  // admin catalog view needs to see drafts too (that's the whole point of
  // having a draft state) — it can still narrow with ?isPublished=true|false
  // if it wants to filter, but defaults to showing everything.
  if (!adminMode) {
    query.isPublished = true;
  } else if (req.query.isPublished === "true" || req.query.isPublished === "false") {
    query.isPublished = req.query.isPublished === "true";
  }

  if (["physical", "digital", "service"].includes(req.query.type)) {
    query.type = req.query.type;
  }

  const rawCategoryId = req.query.category || req.query.categoryUuid;

  if (rawCategoryId) {
    const categoryObjectId = mongoose.Types.ObjectId.isValid(rawCategoryId) ? rawCategoryId : null;

    if (!categoryObjectId || !(await Category.exists({ _id: categoryObjectId }))) {
      throw new ApiError(400, "Invalid category", [{ code: "INVALID_CATEGORY" }]);
    }

    query.category = { $in: await getCategoryAndDescendantIds(categoryObjectId) };
  } else if (req.query.categoryName) {
    const escapedName = req.query.categoryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = await Category.find({
      name: { $regex: `^${escapedName}$`, $options: "i" },
    }).select("_id");

    if (!matches.length) {
      throw new ApiError(400, "Invalid category", [{ code: "INVALID_CATEGORY" }]);
    }

    const idSets = await Promise.all(matches.map((c) => getCategoryAndDescendantIds(c._id)));
    query.category = { $in: [...new Set(idSets.flat())] };
  }

  // Only physical products are inventory-tracked — digital/service products
  // have no real stock concept (schema defaults `stock` to 0 for every
  // type), so they must never be excluded by an "in stock" filter or
  // included by an "out of stock" one. Uses $and (not $or) to compose
  // safely alongside the weight-range filter below, which owns its own
  // top-level $or.
  if (req.query.inStock === "true") {
    query.$and = (query.$and || []).concat([
      { $or: [{ type: { $ne: "physical" } }, { stock: { $gt: 0 } }] },
    ]);
  } else if (req.query.inStock === "false") {
    // Intersected via $and rather than assigned to query.type directly —
    // that would silently clobber an explicit ?type=digital filter above
    // instead of correctly matching nothing (digital products are never
    // "out of stock").
    query.$and = (query.$and || []).concat([{ type: "physical" }, { stock: { $lte: 0 } }]);
  }

  const minPrice = Number(req.query.minPrice);
  const maxPrice = Number(req.query.maxPrice);

  if (!Number.isNaN(minPrice) || !Number.isNaN(maxPrice)) {
    query.price = {};
    if (!Number.isNaN(minPrice)) query.price.$gte = minPrice;
    if (!Number.isNaN(maxPrice)) query.price.$lte = maxPrice;
  }

  const minWeight = Number(req.query.minWeight);
  const maxWeight = Number(req.query.maxWeight);

  if (!Number.isNaN(minWeight) || !Number.isNaN(maxWeight)) {
    const range = {};
    if (!Number.isNaN(minWeight)) range.$gte = minWeight;
    if (!Number.isNaN(maxWeight)) range.$lte = maxWeight;

    query.weight = range;
  }

  return query;
}

const SORT_MAP = {
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  name_asc: { name: 1 },
  name_desc: { name: -1 },
  oldest: { createdAt: 1 },
  newest: { createdAt: -1 },
};

// Variant products carry a null top-level `price` (see product.modal.js —
// hasVariants clears it since each variant has its own). Price filtering/
// sorting need a real number to compare against, so fall back to the
// cheapest variant, matching the "starting from" price shown on listing
// cards.
function getEffectivePrice(product) {
  if (product.price != null) return product.price;
  const variantPrices = (product.variants || [])
    .flatMap((v) =>
      v.subVariants?.length ? v.subVariants.map((sv) => sv.price) : [v.price],
    )
    .filter((v) => v != null);
  return variantPrices.length ? Math.min(...variantPrices) : null;
}

// Computed from an already-fetched product list rather than a Mongo
// aggregate on the raw `price` field — variant products carry a null
// top-level price (see getEffectivePrice), so the price range here has to
// be derived the same way getProducts derives each product's displayed
// price.
function computeFacetsFromProducts(products) {
  const distinctValues = (accessor) => [...new Set(products.map(accessor).filter(Boolean))];

  const prices = products.map(getEffectivePrice).filter((v) => v != null);
  const weights = products.map((p) => p.weight).filter((v) => v != null);

  return {
    type: distinctValues((p) => p.type),
    weight: {
      min: weights.length ? Math.min(...weights) : null,
      max: weights.length ? Math.max(...weights) : null,
    },
    price: {
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
    },
  };
}

export const getProducts = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const query = await buildProductQuery(req);

  // Variant products carry a null top-level `price` (see getEffectivePrice),
  // so price filtering/sorting/faceting can't happen at the Mongo level for
  // them — pull minPrice/maxPrice back out of the Mongo query, fetch every
  // product matching the OTHER filters, then filter/sort/paginate by the
  // effective price in JS.
  const { $gte: minPrice, $lte: maxPrice } = query.price || {};
  delete query.price;

  const sortParam = req.query.sort;
  const isPriceSort = sortParam === "price_asc" || sortParam === "price_desc";
  const mongoSort = isPriceSort ? { createdAt: 1 } : SORT_MAP[sortParam] || { createdAt: 1 };

  const [products, cart, wishlist] = await Promise.all([
    Product.find(query)
      .select({
        name: 1,
        slug: 1,
        thumbnail: 1,
        price: 1,
        mrp: 1,
        gst: 1,
        priceWithGst: 1,

        type: 1,
        stock: 1,
        discount: 1,
        hasVariants: 1,
        isFeatured: 1,
        isPublished: 1,
        category: 1,
        sku: 1,
        createdAt: 1,
        source: 1,

        soldByRatti: 1,
        pricePerRatti: 1,
        minRatti: 1,
        maxRatti: 1,

        "variants._id": 1,
        "variants.name": 1,
        "variants.value": 1,
        "variants.price": 1,
        "variants.mrp": 1,
        "variants.priceWithGst": 1,
        "variants.stock": 1,
        "variants.metaTitle": 1,
        "variants.metaDescription": 1,
        "variants.subVariants": 1,
      })
      .populate("category", "name slug")
      .sort(mongoSort)
      .lean(),

    req.user?._id
      ? Cart.findOne({ user: req.user._id }).select("items.product").lean()
      : null,

    req.user?._id
      ? Wishlist.findOne({ user: req.user._id })
          .select("products.product")
          .lean()
      : null,
  ]);

  let filtered = products;

  if (minPrice != null || maxPrice != null) {
    filtered = filtered.filter((p) => {
      const effectivePrice = getEffectivePrice(p);
      // No price on the product or any variant at all — nothing to compare
      // against, so keep it rather than hiding it from every price search.
      if (effectivePrice == null) return true;
      if (minPrice != null && effectivePrice < minPrice) return false;
      if (maxPrice != null && effectivePrice > maxPrice) return false;
      return true;
    });
  }

  if (isPriceSort) {
    filtered = [...filtered].sort((a, b) => {
      const priceA = getEffectivePrice(a) ?? 0;
      const priceB = getEffectivePrice(b) ?? 0;
      return sortParam === "price_asc" ? priceA - priceB : priceB - priceA;
    });
  }

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * limit, (page - 1) * limit + limit);

  const facets = req.query.includeFacets === "true" ? computeFacetsFromProducts(filtered) : null;

  // faster lookup
  const cartProductIds = new Set(
    cart?.items?.map((item) => String(item.product)) || [],
  );

  const wishlistProductIds = new Set(
    wishlist?.products?.map((item) => String(item.product)) || [],
  );

  const updatedProducts = paged.map((product) => ({
    ...product,
    isInCart: cartProductIds.has(String(product._id)),
    isInWishlist: wishlistProductIds.has(String(product._id)),
  }));

  return res.json(
    new ApiResponse(200, updatedProducts, "Products fetched", {
      total,
      page,
      limit,
      ...(facets ? { facets } : {}),
    }),
  );
});

// Admin catalog view — same filter/sort/pagination surface as the public
// listing, but shows drafts too (isPublished left unfiltered unless the
// caller explicitly asks) and skips the cart/wishlist lookups, which don't
// apply to an admin session. Needed because req.user on the public route
// (optionalVerifyToken, ACCESS_TOKEN_SECRET) is never populated for an
// admin's Bearer token anyway — silently falling back to the public,
// published-only view, which is why a freshly-created draft product was
// invisible even to the admin who created it.
export const getAdminProducts = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const query = await buildProductQuery(req, { adminMode: true });
  const sort = SORT_MAP[req.query.sort] || { createdAt: -1 };

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate("category", "name slug")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort(sort)
      .lean(),
    Product.countDocuments(query),
  ]);

  return res.json(
    new ApiResponse(200, products, "Products fetched", { total, page, limit }),
  );
});

export const getProductById = asyncHandler(async (req, res) => {
  // .lean() so the `...product` spread below actually copies plain fields
  // (spreading a live Mongoose document doesn't) — and populate category so
  // the admin's view page can show a name instead of a raw ObjectId.
  const product = await Product.findById(req.params.id)
    .populate("category", "name slug")
    .lean();

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  const stock =
    product.variants && product.variants.length > 0
      ? product.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
      : product.stock || 0;

  const formattedProduct = {
    ...product,
    stock,
    images: product.images || [],
    thumbnail: product.thumbnail || null,
    videos: product.videos || [],
  };

  return res.json(new ApiResponse(200, formattedProduct, "Product fetched"));
});

export const updateProductStatus = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  const parsed = productStatusSchemaZod.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Validation failed", parsed.error.issues);
  }

  const wasPublished = product.isPublished;

  product.isPublished = parsed.data.isPublished;

  await product.save();

  await logActivity({
    admin: req.user,
    action: "product.status_update",
    targetType: "Product",
    targetId: product._id,
    targetLabel: product.name,
    changes: diffFields({ isPublished: wasPublished }, { isPublished: product.isPublished }, ["isPublished"]),
    skipIfNoChanges: true,
  });

  // Populated the same way getAdminProducts returns it — the admin list
  // renders category.name, and without this the response here is a bare
  // ObjectId, which replaced the properly-populated row in the frontend
  // store and made the category column show a raw id after every toggle.
  await product.populate("category", "name slug");

  return res.json(
    new ApiResponse(
      200,
      product,
      product.isPublished ? "Product published" : "Product unpublished",
    ),
  );
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  const deletedName = product?.name;
  const deletedId = product._id;

  await product.deleteOne();

  await logActivity({
    admin: req.user,
    action: "product.delete",
    targetType: "Product",
    targetId: deletedId,
    targetLabel: deletedName,
    changes: [],
  });

  return res.json(new ApiResponse(200, null, "Product deleted"));
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const product = await Product.findOne({
    slug,
    isPublished: true,
  })
    .select("-variants.downloadableFile")
    .populate("category")
    .lean();

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  return res.json(
    new ApiResponse(200, product, "Product fetched successfully"),
  );
});
