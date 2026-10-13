import { z } from "zod";

export const createCourseSchema = z.object({
  title: z.string().min(2),
  shortDescription: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  instructorName: z.string().optional(),
  language: z.string().optional(),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  price: z.coerce.number().min(0),
  originalPrice: z.coerce.number().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  isFeatured: z.coerce.boolean().optional(),
  redirectUrl: z.string().url(),
  platformName: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  totalDurationMinutes: z.coerce.number().optional(),
   metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  
});

export const updateCourseSchema = createCourseSchema.partial();
