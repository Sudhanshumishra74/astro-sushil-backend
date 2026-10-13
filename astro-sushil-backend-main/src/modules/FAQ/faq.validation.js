import { z } from "zod";

export const faqCreateSchema = z.object({
  question: z.string().min(5, "Question required"),
  answer: z.string().min(5, "Answer required"),
  page: z.string().min(1, "Page required"),
  isActive: z.boolean().optional(),
  order: z.number().optional(),
});

export const faqUpdateSchema = faqCreateSchema.partial();