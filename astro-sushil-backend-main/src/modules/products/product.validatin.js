import { z } from "zod";

const gstSchema = z.object({
  enabled: z.coerce.boolean().optional(),
  rate: z.coerce.number().min(0).max(100).optional(),
  type: z.enum(["inclusive", "exclusive"]).optional(),
});

const subVariantSchema = z.object({
  _id: z.string().optional(),

  name: z.string().optional(),
  value: z.string().optional(),

  price: z.coerce.number().optional(),
  mrp: z.coerce.number().optional(),
  stock: z.coerce.number().optional(),

  weight: z.coerce.number().optional(),
  dimensions: z
    .object({
      length: z.coerce.number().optional(),
      width: z.coerce.number().optional(),
      height: z.coerce.number().optional(),
    })
    .optional(),
});

const variantSchema = z.object({
  // Without this declared, Zod strips every variant's _id before
  // updateProduct's Object.assign(product, parsed.data) persists it —
  // silently rotating every variant's id on every save (any field, not
  // just variants) and orphaning any cart/order line that referenced the
  // old id. See product.controller.js's mergedVariants for where the
  // correct id actually lives pre-Zod.
  _id: z.string().optional(),

  name: z.string().optional(),
  value: z.string().optional(),

  price: z.coerce.number().optional(),
  mrp: z.coerce.number().optional(),
  stock: z.coerce.number().optional(),

  downloadableFile: z.string().url().nullable().optional(),

  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),

  // A variant like "Large" can weigh meaningfully more than the product's
  // own top-level weight — see product.modal.js's variantSchema. Zod
  // strips any key it doesn't know about before the parsed result gets
  // persisted (product.controller.js's updateProduct does
  // Object.assign(product, parsed.data), not the raw merged body), so
  // without these declared here the fields never survive a save even
  // though the Mongoose schema and the admin form both support them.
  weight: z.coerce.number().optional(),
  dimensions: z
    .object({
      length: z.coerce.number().optional(),
      width: z.coerce.number().optional(),
      height: z.coerce.number().optional(),
    })
    .optional(),

  // Cascading second level — see product.modal.js's variantSchema.
  subVariants: z.array(subVariantSchema).optional(),
});

// _id must stay declared here — an undeclared field is silently stripped by
// Zod before Object.assign(product, parsed.data) persists it, which would
// rotate every certificate's _id on every save and orphan any cart/order
// line that referenced the old id (same bug class documented above for
// variants/subVariants).
const certificateSchema = z.object({
  _id: z.string().optional(),

  name: z.string().min(1),
  price: z.coerce.number().min(0).optional(),
  includedInPrice: z.coerce.boolean().optional(),
});

export const productSchemaZod = z
  .object({
    name: z.string().min(2, "Name required"),

    hasVariants: z.coerce.boolean().optional(),

    shortDescription: z.string().optional(),
    description: z.string().optional(),

    type: z.enum(["physical", "digital", "service"]).optional(),
    category: z.string().optional(),

    images: z.array(z.string()).optional(),
    thumbnail: z.string().optional(),
    videos: z.array(z.string()).max(2, "Up to 2 videos allowed").optional(),

    mrp: z.coerce.number().optional(),

    discountType: z.enum(["percentage", "fixed"]).optional(),
    discountValue: z.coerce.number().optional(),

    stock: z.coerce.number().optional(),
    sku: z.string().optional(),

    // ✅ UPDATED
    variants: z.array(variantSchema).optional(),

    certificates: z.array(certificateSchema).optional(),

    weight: z.coerce.number().optional(),

    dimensions: z
      .object({
        length: z.coerce.number().optional(),
        width: z.coerce.number().optional(),
        height: z.coerce.number().optional(),
      })
      .optional(),

    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    keywords: z.array(z.string()).optional(),

    isFeatured: z.coerce.boolean().optional(),
    isTrending: z.coerce.boolean().optional(),
    isBestSeller: z.coerce.boolean().optional(),
    isPublished: z.coerce.boolean().optional(),

    gst: gstSchema.optional(),

    // Gemstone-by-ratti pricing — see product.modal.js. Mutually exclusive
    // with hasVariants/variants.
    soldByRatti: z.coerce.boolean().optional(),
    pricePerRatti: z.coerce.number().positive().optional(),
    minRatti: z.coerce.number().positive().optional(),
    maxRatti: z.coerce.number().positive().optional(),
    outOfStockRattis: z.array(z.coerce.number()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.soldByRatti) {
      if (data.pricePerRatti === undefined) {
        ctx.addIssue({
          path: ["pricePerRatti"],
          message: "Price per ratti required",
        });
      }

      if (data.hasVariants) {
        ctx.addIssue({
          path: ["hasVariants"],
          message: "A gemstone product sold by ratti cannot also have variants",
        });
      }

      if (
        data.minRatti !== undefined &&
        data.maxRatti !== undefined &&
        data.maxRatti < data.minRatti
      ) {
        ctx.addIssue({
          path: ["maxRatti"],
          message: "Max ratti must be greater than or equal to min ratti",
        });
      }
    } else if (data.hasVariants) {
      if (!data.variants || data.variants.length === 0) {
        ctx.addIssue({
          path: ["variants"],
          message: "Variants required",
        });
      }

      if (data.mrp !== undefined) {
        ctx.addIssue({
          path: ["mrp"],
          message: "Do not send mrp when variants exist",
        });
      }
    } else {
      if (data.mrp === undefined) {
        ctx.addIssue({
          path: ["mrp"],
          message: "MRP required when no variants",
        });
      }
    }

    if (data.type === "digital" && data.hasVariants) {
      const invalid = data.variants?.some((v) => !v.downloadableFile);

      if (invalid) {
        ctx.addIssue({
          path: ["variants"],
          message: "Each digital variant must have a downloadable file",
        });
      }
    }
  });

// Deliberately its own tiny schema, not a slice of productUpdateSchemaZod —
// this is the one field a plain publish/unpublish toggle needs.
export const productStatusSchemaZod = z.object({
  isPublished: z.coerce.boolean(),
});

export const productUpdateSchemaZod = z
  .object({
    name: z.string().optional(),
    shortDescription: z.string().optional(),
    description: z.string().optional(),

    type: z.enum(["physical", "digital", "service"]).optional(),
    category: z.string().optional(),

    hasVariants: z.coerce.boolean().optional(),

    price: z.coerce.number().optional(),
    mrp: z.coerce.number().optional(),

    discountType: z.enum(["percentage", "fixed"]).optional(),
    discountValue: z.coerce.number().optional(),

    stock: z.coerce.number().optional(),
    sku: z.string().optional(),

    // ✅ UPDATED
    variants: z.array(variantSchema).optional(),

    certificates: z.array(certificateSchema).optional(),

    keywords: z.array(z.string()).optional(),

    weight: z.coerce.number().optional(),

    dimensions: z
      .object({
        length: z.coerce.number().optional(),
        width: z.coerce.number().optional(),
        height: z.coerce.number().optional(),
      })
      .optional(),

    isFeatured: z.coerce.boolean().optional(),
    isTrending: z.coerce.boolean().optional(),
    isBestSeller: z.coerce.boolean().optional(),
    isPublished: z.coerce.boolean().optional(),

    gst: gstSchema.optional(),

    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),

    // Gemstone-by-ratti pricing — see product.modal.js. Mutually exclusive
    // with hasVariants/variants.
    soldByRatti: z.coerce.boolean().optional(),
    pricePerRatti: z.coerce.number().positive().optional(),
    minRatti: z.coerce.number().positive().optional(),
    maxRatti: z.coerce.number().positive().optional(),
    outOfStockRattis: z.array(z.coerce.number()).optional(),
  })
  .superRefine((data, ctx) => {
    // Mirrors productSchemaZod's cross-field check — updateProduct's
    // controller always resends hasVariants (defaulted false) and mrp on
    // every submit (Addproduct.jsx is a single form used for both create
    // and edit), so this check applies the same way on both paths.
    if (data.soldByRatti) {
      if (data.pricePerRatti === undefined) {
        ctx.addIssue({
          path: ["pricePerRatti"],
          message: "Price per ratti required",
        });
      }

      if (data.hasVariants) {
        ctx.addIssue({
          path: ["hasVariants"],
          message: "A gemstone product sold by ratti cannot also have variants",
        });
      }

      if (
        data.minRatti !== undefined &&
        data.maxRatti !== undefined &&
        data.maxRatti < data.minRatti
      ) {
        ctx.addIssue({
          path: ["maxRatti"],
          message: "Max ratti must be greater than or equal to min ratti",
        });
      }
    } else if (data.hasVariants) {
      if (!data.variants || data.variants.length === 0) {
        ctx.addIssue({
          path: ["variants"],
          message: "Variants required",
        });
      }

      if (data.mrp !== undefined) {
        ctx.addIssue({
          path: ["mrp"],
          message: "Do not send mrp when variants exist",
        });
      }
    } else {
      if (data.mrp === undefined) {
        ctx.addIssue({
          path: ["mrp"],
          message: "MRP required when no variants",
        });
      }
    }

    if (data.type === "digital" && data.hasVariants) {
      const invalid = data.variants?.some((v) => !v.downloadableFile);

      if (invalid) {
        ctx.addIssue({
          path: ["variants"],
          message: "Each digital variant must have a downloadable file",
        });
      }
    }
  });
