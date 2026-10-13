
import { z } from "zod";

export const contactSchemaZod = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100),

  email: z
  .string()
  .optional()
  .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: "Invalid email address",
  }),

  phone: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?[1-9]\d{6,14}$/.test(val), {
      message: "Enter a valid phone number (7–15 digits, with optional + country code)",
    }),

  subject: z
    .string()
    .max(150)
    .optional(),

  message: z
    .string()
    .min(5, "Message must be at least 5 characters")
    .max(2000),
});

export const contactRemarksSchemaZod = z.object({
  remarks: z.string().max(2000, "Remarks must be under 2000 characters").optional().default(""),
});