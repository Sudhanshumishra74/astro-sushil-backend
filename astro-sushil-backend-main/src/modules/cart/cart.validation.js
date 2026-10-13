import { z } from "zod";

export const addToCartSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
  quantity: z.coerce.number().min(1).default(1),
});

export const updateCartSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
  quantity: z.coerce.number().min(1),
});

export const removeItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
});

export const applyCouponSchema = z.object({
  code: z.string().min(2),
});