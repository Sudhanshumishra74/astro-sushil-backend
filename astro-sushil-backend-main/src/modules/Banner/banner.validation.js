import { z } from "zod";

const buttonSchema = z.object({
  text: z.string().min(1, "Button text required"),
  link: z.string().url("Invalid URL"),
});
const validTypes = ["Slider", "Page",];
export const createBannerSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(validTypes).optional().refine((val) => !val || validTypes.includes(val), {
    message: "Please select a valid banner type",
  }),
  buttons: z
    .union([z.array(buttonSchema), z.string()])
    .optional()
    .transform((val) => {
      if (!val) return [];

      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      }

      return val;
    }),
  page: z.string().optional(),
  order: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val !== undefined ? Number(val) : undefined)),

  isActive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }),
});
export const updateBannerSchema = createBannerSchema.partial();

export const bannerIdParamSchema = z.object({
  id: z.string().min(1, "Banner ID is required"),
});

export const getBannerQuerySchema = z.object({
  page: z.string().optional(),
  type: z.enum(["hero", "slider", "offer", "banner"]).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});
