import { z } from "zod";

const gstSchema = z.object({
  enabled: z.boolean().optional(),
  rate: z.coerce.number().min(0).max(100).optional(),
  type: z.enum(["inclusive", "exclusive"]).optional(),
});

export const consultationZod = z.object({
  title: z.string().min(2),

  type: z.enum(["normal", "special"]).optional(),

  description: z.string().optional(),

  responseDays: z.number().min(0).optional(),

  includes: z.array(z.string()).optional(),

  duration: z.number().min(5),

  priceLabel: z.string().optional(),

  note: z.string().optional(),

  isActive: z.boolean().optional(),

  modes: z
    .array(
      z.object({
        mode: z.enum(["audio", "video", "in_person"]),

        price: z.object({
          inr: z.number().min(1),
        }),

        gst: gstSchema.optional(),

        _delete: z.boolean().optional(),
      }),
    )
    .min(1),
});
