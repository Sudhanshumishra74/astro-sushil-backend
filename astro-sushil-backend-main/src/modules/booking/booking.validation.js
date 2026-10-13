import { z } from "zod";

export const bookingZod = z.object({
  consultationId: z.string(),

  mode: z.enum(["audio", "video", "in_person"]),

  currency: z
    .string()
    .trim()
    .min(3)
    .max(5)
    .transform((val) => val.toUpperCase())
    .default("INR"),

  exchangeRate: z.number().min(0).default(1),
  date: z.string(),
  slot: z.string(),

  userId: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),

  discountType: z.enum(["FLAT", "PERCENTAGE"]).optional(),
  discountValue: z.number().min(0).optional(),

  note: z.string().trim().max(1000).optional(),
}).refine(
  (data) =>
    data.discountType !== "PERCENTAGE" ||
    data.discountValue === undefined ||
    data.discountValue <= 100,
  { message: "Percentage discount cannot exceed 100", path: ["discountValue"] },
);
