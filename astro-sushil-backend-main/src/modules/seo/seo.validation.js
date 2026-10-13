import { z } from "zod";

export const createSeo = z.object({
  name: z
    .string()
    .min(1, "Page name is required")
    .transform((val) => val.toLowerCase()),

  metaTitle: z.string().min(1, "Meta title is required"),

  metaDescription: z.string().min(1, "Meta description is required"),
});

export const updateSeo = z.object({
  name: z.string().optional(),

  metaTitle: z.string().optional(),

  metaDescription: z.string().optional(),
});
