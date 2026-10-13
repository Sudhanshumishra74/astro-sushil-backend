import { z } from "zod";

export const settingSchemaZod = z.object({
  branding: z
    .object({
      siteName: z.string().min(1).optional(),
      logoUrl: z.string().url().optional().or(z.literal("")),
      faviconUrl: z.string().url().optional().or(z.literal("")),
    })
    .optional(),

  contact: z
    .object({
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional(),
      whatsapp: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),

  socialLinks: z
    .object({
      facebook: z.string().url().optional().or(z.literal("")),
      instagram: z.string().url().optional().or(z.literal("")),
      twitter: z.string().url().optional().or(z.literal("")),
      youtube: z.string().url().optional().or(z.literal("")),
      linkedin: z.string().url().optional().or(z.literal("")),
    })
    .optional(),

  business: z
    .object({
      companyName: z.string().optional(),
      gstNumber: z.string().optional(),
      panNumber: z.string().optional(),
    })
    .optional(),

  payment: z
    .object({
      currency: z.string().optional(),
      taxPercent: z.coerce.number().min(0).optional(),
      codEnabled: z.coerce.boolean().optional(),
      razorpayKey: z.string().optional(),
      razorpaySecret: z.string().optional(),
      stripeKey: z.string().optional(),
      stripeSecret: z.string().optional(),
    })
    .optional(),

  shipping: z
    .object({
      freeShippingThreshold: z.coerce.number().optional(),
      baseDeliveryCharge: z.coerce.number().optional(),
      deliveryChargePerKM: z.coerce.number().optional(),
      maxCODLimit: z.coerce.number().optional(),
      supportedAreas: z.array(z.string()).optional(),
    })
    .optional(),

  product: z
    .object({
      lowStockWarning: z.coerce.number().optional(),
      maxQuantityInCart: z.coerce.number().optional(),
    })
    .optional(),

  offers: z
    .object({
      referralRewardPercent: z.coerce.number().optional(),
      enableCoupons: z.coerce.boolean().optional(),
      flashSaleEnabled: z.coerce.boolean().optional(),
    })
    .optional(),

  order: z
    .object({
      autoCancelUnpaidMinutes: z.coerce.number().optional(),
      returnPolicyDays: z.coerce.number().optional(),
      maxOrderValue: z.coerce.number().optional(),
    })
    .optional(),

  communication: z
    .object({
      enableOrderEmails: z.coerce.boolean().optional(),
      enableOrderSMS: z.coerce.boolean().optional(),
      enablePushNotifications: z.coerce.boolean().optional(),
    })
    .optional(),

  smtp: z
    .object({
      host: z.string().optional(),
      port: z.coerce.number().optional(),
      secure: z.coerce.boolean().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      fromEmail: z.string().email().optional().or(z.literal("")),
    })
    .optional(),

  sms: z
    .object({
      provider: z.string().optional(),
      apiKey: z.string().optional(),
      senderId: z.string().optional(),
    })
    .optional(),

  otp: z
    .object({
      expiryMinutes: z.coerce.number().optional(),
      resendTimeoutSec: z.coerce.number().optional(),
    })
    .optional(),

  system: z
    .object({
      maintenanceMode: z.coerce.boolean().optional(),

    })
    .optional(),

  topBar: z
    .object({
      enabled: z.coerce.boolean().optional(),
      text: z.string().optional(),
      bgColor: z
        .string()
        .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
        .optional()
        .or(z.literal("")),
      textColor: z
        .string()
        .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
        .optional()
        .or(z.literal("")),
      linkEnabled: z.coerce.boolean().optional(),
      // Internal route (e.g. "/free-online-kundli") or a full external URL —
      // not restricted to z.string().url() since relative paths are valid.
      linkUrl: z.string().optional(),
    })
    .optional(),

  highlightsBar: z
    .object({
      enabled: z.coerce.boolean().optional(),
      text: z.string().optional(),
      bgColor: z
        .string()
        .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
        .optional()
        .or(z.literal("")),
      textColor: z
        .string()
        .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
        .optional()
        .or(z.literal("")),
      linkEnabled: z.coerce.boolean().optional(),
      // Internal route (e.g. "/free-online-kundli") or a full external URL —
      // not restricted to z.string().url() since relative paths are valid.
      linkUrl: z.string().optional(),
    })
    .optional(),

  legal: z
    .object({
      privacyPolicy: z.string().optional(),
      termsConditions: z.string().optional(),
      returnPolicyText: z.string().optional(),
      cancellationRefundPolicy: z.string().optional(),
      shippingDeliveryPolicy: z.string().optional(),
    })
    .optional(),
});
