import { z } from "zod";

export const createOrderSchema = z.object({
  paymentMethod: z.enum(["cod", "razorpay"]),

  currency: z.string().trim().toUpperCase().default("INR").optional(),
   currencyRate: z
      .number()
      .optional()
      .default(1),


  addressId: z.string().optional().nullable(),

  // Client-generated per-checkout-attempt token — see createOrder's use of
  // it for why (a network retry or a double-click shouldn't create two
  // separate orders off the same cart).
  idempotencyKey: z.string().trim().min(1).max(100).optional().nullable(),
});

export const verifyPaymentSchema = z.object({
  orderId: z.string(),

  razorpay_payment_id: z.string(),

  razorpay_order_id: z.string(),

  razorpay_signature: z.string(),
});
