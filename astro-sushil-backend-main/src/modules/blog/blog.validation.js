import { z } from "zod";

export const blogSchemaZod = z.object({
  title: z.string().min(3),
  slug: z.string().min(3),
  shortDescription: z.string().min(10),
  content: z.string().min(20),
  category: z.string(),

  tags: z.array(z.string()).optional(),

 author: z.object({
  name: z.string().optional(),
  avatar: z
    .object({
      url: z.string().optional(),
      key: z.string().optional(),
    })
    .optional(),
}).optional(),

  seo: z
    .object({
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      keywords: z.array(z.string()).optional(),
    })
    .optional(),

  status: z.enum(["draft", "published"]).optional(),
  isFeatured: z.coerce.boolean().optional(),
  publishedAt: z.coerce.date().optional()
});