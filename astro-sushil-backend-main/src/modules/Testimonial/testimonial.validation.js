import { z } from "zod";

export const createTestimonialSchema = z.object({
  name: z.string().min(1),
  designation: z.string().optional(),

  message: z.string().min(1),

  rating: z.coerce.number().min(1).max(5).optional(),

  serviceName: z.string().optional(),
  tagline: z.string().optional(),

  type: z.enum(["text", "video"]).optional(),

  videoUrl: z.string().url().optional(),

  page: z.string().optional(),

  order: z.coerce.number().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const updateTestimonialSchema = createTestimonialSchema.partial();

export const testimonialIdParamSchema = z.object({
  id: z.string().min(1),
});
