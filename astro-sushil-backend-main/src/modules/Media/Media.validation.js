import { z } from "zod";

export const mediaSectionEnum = z.enum(["podcast", "celebrity", "wishes"]);

export const mediaTypeEnum = z.enum(["video", "image"]);

const youtubeRegex = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.be)\//;

const baseMediaSchema = z.object({
  title: z.string().min(2, "Title is required"),

  description: z.string().optional(),

  section: mediaSectionEnum,

  mediaUrl: z.string().optional(),

  thumbnail: z.string().optional(),

  tag: z.string().optional(),

  personName: z.string().optional(),

  background: z.string().optional(),

  isActive: z.coerce.boolean().optional(),

  order: z.coerce.number().optional(),
});

export const createMediaSchema = baseMediaSchema.superRefine((data, ctx) => {
  if (data.section === "wishes") {
    if (!data.personName) {
      ctx.addIssue({
        path: ["personName"],
        code: z.ZodIssueCode.custom,
        message: "Person name is required",
      });
    }
  }

  // ── Podcast ────────────────
  if (data.section === "podcast") {
    if (!data.mediaUrl) {
      ctx.addIssue({
        path: ["mediaUrl"],
        code: z.ZodIssueCode.custom,
        message: "Youtube URL is required",
      });
    }

    if (data.mediaUrl && !youtubeRegex.test(data.mediaUrl)) {
      ctx.addIssue({
        path: ["mediaUrl"],
        code: z.ZodIssueCode.custom,
        message: "Only Youtube URL allowed",
      });
    }
  }
});

export const updateMediaSchema = baseMediaSchema.partial();
