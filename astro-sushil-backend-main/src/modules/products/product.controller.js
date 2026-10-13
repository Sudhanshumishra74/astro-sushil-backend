import {
  productSchemaZod,
  productUpdateSchemaZod,
} from "./product.validatin.js";
import { uploadFile, deleteFile } from "../../service/UploadAws.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import Cart from "../cart/cart.modal.js";
import Wishlist from "../wishlist/wishlist.modal.js";
import { createWatermarkedImage } from "../../utils/createWatermarkedImage.js";
import { Product } from "./product.modal.js";

const safeJSON = (value, fallback) => {
  try {
    if (!value) return fallback;
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
};

export const createProduct = asyncHandler(async (req, res) => {
  let images = [];
  let thumbnail = null;

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

  // ✅ 3. Build body (FIXED: use updated variants)
  const body = {
    ...req.body,

    hasVariants:
      req.body.hasVariants === "true" || req.body.hasVariants === true,

    discountValue: Number(req.body.discountValue || 0),

    discountType: req.body.discountType || "percentage",

    variants, // ✅ FIX: use enriched variants

    keywords: safeJSON(req.body.keywords, []),

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

  // ✅ 7. Create product
  const product = await Product.create({
    ...parsed.data,
    images,
    thumbnail,
  });

  return res.status(201).json(new ApiResponse(201, product, "Product created"));
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  console.log("===>", req.body);

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

  const mergedVariants = existingVariants.map((existing) => {
    const updated = incomingVariantsMap.get(String(existing._id));

    if (!updated) return existing;

    return {
      ...(existing.toObject?.() || existing),
      ...updated,
      downloadableFile: updated.downloadableFile || existing.downloadableFile,
    };
  });

  const newVariants = incomingVariants.filter((variant) => {
    const variantKey = String(variant._id || variant.id || "");
    return !existingVariantIds.has(variantKey);
  });

  const body = {
    ...req.body,

    hasVariants:
      req.body.hasVariants === "true" || req.body.hasVariants === true,

    isFeatured: req.body.isFeatured === "true" || req.body.isFeatured === true,

    isTrending: req.body.isTrending === "true" || req.body.isTrending === true,

    isBestSeller:
      req.body.isBestSeller === "true" || req.body.isBestSeller === true,

    isPublished:
      req.body.isPublished === "true" || req.body.isPublished === true,

    variants: [...mergedVariants, ...newVariants],

    keywords:
      req.body.keywords !== undefined
        ? safeJSON(req.body.keywords, [])
        : product.keywords,

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

  Object.assign(product, parsed.data);

  await product.save();

  return res.json(new ApiResponse(200, product, "Product updated"));
});

export const getProducts = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = req.query.search || "";

  const query = {
    isPublished: true,
    name: { $regex: search, $options: "i" },
  };

  const [products, total, cart, wishlist] = await Promise.all([
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

        "variants._id": 1,
        "variants.name": 1,
        "variants.value": 1,
        "variants.price": 1,
        "variants.mrp": 1,
        "variants.priceWithGst": 1,
        "variants.stock": 1,
        "variants.metaTitle": 1,
        "variants.metaDescription": 1,
      })
      .populate("category", "name slug")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: 1 })
      .lean(),

    Product.countDocuments(query),

    req.user?._id
      ? Cart.findOne({ user: req.user._id }).select("items.product").lean()
      : null,

    req.user?._id
      ? Wishlist.findOne({ user: req.user._id })
          .select("products.product")
          .lean()
      : null,
  ]);

  // faster lookup
  const cartProductIds = new Set(
    cart?.items?.map((item) => String(item.product)) || [],
  );

  const wishlistProductIds = new Set(
    wishlist?.products?.map((item) => String(item.product)) || [],
  );

  const updatedProducts = products.map((product) => ({
    ...product,
    isInCart: cartProductIds.has(String(product._id)),
    isInWishlist: wishlistProductIds.has(String(product._id)),
  }));

  return res.json(
    new ApiResponse(200, updatedProducts, "Products fetched", {
      total,
      page,
      limit,
    }),
  );
});

export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  let stock = 0;

  // ✅ Variant based stock calculation
  if (product.variants && product.variants.length > 0) {
    stock = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  } else {
    stock = product.stock || 0;
  }

  // ✅ Safe images & thumbnail (kabhi undefined na aaye)
  const formattedProduct = {
    ...product,
    stock, // 👈 frontend same field use karega
    images: product.images || [],
    thumbnail: product.thumbnail || null,
  };

  return res.json(new ApiResponse(200, product, "Product fetched"));
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  return res.json(new ApiResponse(200, null, "Product deleted"));
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const product = await Product.findOne({
    slug,
    isPublished: true,
  })
    .select("-variants.downloadableFile")
    .populate("category");

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  return res.json(
    new ApiResponse(200, product, "Product fetched successfully"),
  );
});
