import { z } from "zod";

export const addToCartSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
  // Cascading second level — required only when the selected variant has
  // sub-variants, enforced in the controller (not here, since it depends on
  // the product being loaded).
  subVariantId: z.string().nullable().optional(),
  // Required only for a soldByRatti product — enforced in the controller,
  // same reasoning as subVariantId above.
  selectedRatti: z.coerce.number().positive().nullable().optional(),
  // Single certificate chosen from product.certificates — optional,
  // enforced/resolved in the controller (depends on the product/Setting
  // being loaded), same reasoning as subVariantId above.
  certificateId: z.string().nullable().optional(),
  quantity: z.coerce.number().min(1).default(1),
});

export const updateCartSchema = z.object({
  // Preferred identifier — the cart subdocument's own _id, unambiguous even
  // when two lines share a product with no variant to tell them apart.
  // productId (+ variant fallback fields) stays required for older callers,
  // but the controller prefers itemId whenever it's present.
  itemId: z.string().nullable().optional(),
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
  subVariantId: z.string().nullable().optional(),
  selectedRatti: z.coerce.number().positive().nullable().optional(),
  certificateId: z.string().nullable().optional(),
  quantity: z.coerce.number().min(1),
});

export const removeItemSchema = z.object({
  itemId: z.string().nullable().optional(),
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
  subVariantId: z.string().nullable().optional(),
  selectedRatti: z.coerce.number().positive().nullable().optional(),
  certificateId: z.string().nullable().optional(),
});

export const applyCouponSchema = z.object({
  code: z.string().min(2),
});
