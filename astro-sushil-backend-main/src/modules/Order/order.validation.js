import { z } from "zod";

export const createOrderSchema = z.object({
  paymentMethod: z.enum(["cod", "razorpay"]),

  currency: z.string().trim().toUpperCase().default("INR").optional(),
   currencyRate: z
      .number()
      .optional()
      .default(1),


  addressId: z.string().optional().nullable(),
});

export const verifyPaymentSchema = z.object({
  orderId: z.string(),

  razorpay_payment_id: z.string(),

  razorpay_order_id: z.string(),

  razorpay_signature: z.string(),
});
