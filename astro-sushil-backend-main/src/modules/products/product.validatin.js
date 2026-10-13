import { z } from "zod";

const gstSchema = z.object({
  enabled: z.coerce.boolean().optional(),
  rate: z.coerce.number().min(0).max(100).optional(),
  type: z.enum(["inclusive", "exclusive"]).optional(),
});

const variantSchema = z.object({
  name: z.string().optional(),
  value: z.string().optional(),

  price: z.coerce.number().optional(),
  mrp: z.coerce.number().optional(),
  stock: z.coerce.number().optional(),

  downloadableFile: z.string().url().nullable().optional(),

  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
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

    mrp: z.coerce.number().optional(),

    discountType: z.enum(["percentage", "fixed"]).optional(),
    discountValue: z.coerce.number().optional(),

    stock: z.coerce.number().optional(),
    sku: z.string().optional(),

    // ✅ UPDATED
    variants: z.array(variantSchema).optional(),

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
  })
  .superRefine((data, ctx) => {
    if (data.hasVariants) {
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

export const productUpdateSchemaZod = z.object({
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

  keywords: z.array(z.string()).optional(),

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
});
