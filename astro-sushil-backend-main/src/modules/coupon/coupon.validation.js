import { z } from "zod";

export const createCouponSchema = z.object({
  code: z.string().min(3).max(20),

  description: z.string().optional(),

  type: z.enum(["PERCENTAGE", "FLAT"]),

  discount: z.number().positive(),

  maxDiscount: z
    .number()
    .nullable()
    .optional(),

  minOrderAmount: z.number().optional(),

  usageLimit: z.number().nullable().optional(),

  validFrom: z.string().optional(),

  validTill: z.string(),

  couponType: z.enum(["GLOBAL", "INDIVIDUAL"]),

  assignedUsers: z.array(z.string()).optional(),

  oneTimePerUser: z.boolean().optional(),
});
export const updateCouponSchema = createCouponSchema.partial();
