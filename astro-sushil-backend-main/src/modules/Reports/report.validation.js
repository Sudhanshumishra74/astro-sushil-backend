import { z } from "zod";

const gstSchema = z.object({
  enabled: z.coerce.boolean().optional(),
  rate: z.coerce.number().min(0).max(100).optional(),
  type: z.enum(["inclusive", "exclusive"]).optional(),
});

export const createReportSchema = z.object({
  name: z.string().min(3),

  slug: z.string().min(2),

  shortDescription: z.string().optional(),

  description: z.string().min(10),

  coverImage: z.string().min(1),

  originalPrice: z.coerce.number().min(0),

  salePrice: z.coerce.number().min(0),

  isPremium: z.coerce.boolean().optional(),

  isActive: z.coerce.boolean().optional(),

  gst: gstSchema.optional(),

  benefits: z.array(
    z.object({
      title: z.string().min(2),
      description: z.string().min(3),
    }),
  ),

  features: z.array(
    z.object({
      title: z.string().min(2),
      description: z.string().min(3),
      icon: z.string().optional(),
    }),
  ),
});

export const updateReportSchema = createReportSchema.partial();

export const buyReportSchema = z.object({
  reportId: z.string().min(1),

  reportType: z.enum([
    "basic_horoscope_pdf",
    "mini_horoscope_pdf",
    "pro_horoscope_pdf",
    "match_making_pdf",
  ]),

  currency: z.string().optional(),
  currencyRate: z.coerce.number().optional(),

  // NORMAL REPORT
  customerDetails: z
    .object({
      fullName: z.string().min(1),
      email: z.string().email(),
      whatsappNumber: z.string().min(10),
      dateOfBirth: z.string().min(1),
      timeOfBirth: z.string().min(1),
      birthPlace: z.string().min(1),
      gender: z.enum(["male", "female", "other"]),
      pinCode: z.string().min(1),
      reportLanguage: z.string().min(1),
      latitude: z.coerce.number(),
      longitude: z.coerce.number(),
    })
    .optional(),

  // MATCHMAKING REPORT
  matchMakingDetails: z
    .object({
      bride: z.object({
        fullName: z.string().min(1),
        email: z.string().email(),
        whatsappNumber: z.string().min(10),
        dateOfBirth: z.string().min(1),
        timeOfBirth: z.string().min(1),
        birthPlace: z.string().min(1),
        gender: z.enum(["male", "female", "other"]),
        pinCode: z.string().min(1),
        latitude: z.coerce.number(),
        longitude: z.coerce.number(),
      }),

      groom: z.object({
        fullName: z.string().min(1),
        email: z.string().email(),
        whatsappNumber: z.string().min(10),
        dateOfBirth: z.string().min(1),
        timeOfBirth: z.string().min(1),
        birthPlace: z.string().min(1),
        gender: z.enum(["male", "female", "other"]),
        pinCode: z.string().min(1),
        latitude: z.coerce.number(),
        longitude: z.coerce.number(),
      }),

      reportLanguage: z.string().min(1),
    })
    .optional(),
});

export const verifyReportPaymentSchema = z.object({
  razorpay_order_id: z.string(),

  razorpay_payment_id: z.string(),

  razorpay_signature: z.string(),
});
