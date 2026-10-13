import { z } from "zod";

export const categorySchemaZod = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  parent: z.string().optional().nullable(),
});