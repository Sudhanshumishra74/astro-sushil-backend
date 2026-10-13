import { z } from "zod";

export const addressSchemaZod = z.object({
  fullName: z.string().min(2),
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, "Enter a valid phone number (7–15 digits, with optional + country code)"),

  pincode: z.string().min(4),
  state: z.string().min(2),
  city: z.string().min(2),

  addressLine1: z.string().min(5),
  addressLine2: z.string().optional(),

  landmark: z.string().optional(),

  type: z.enum(["home", "work", "other"]).optional(),

  isDefault: z.coerce.boolean().optional(),
});

export const addressUpdateSchemaZod = addressSchemaZod.partial();