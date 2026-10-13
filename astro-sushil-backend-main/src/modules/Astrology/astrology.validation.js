import { z } from "zod";

export const kundliSchema = z.object({
  query: z
    .object({
      latitude: z.coerce.number().min(-90).max(90),
      longitude: z.coerce.number().min(-180).max(180),
      dob: z.string().min(1),
      hour: z.coerce.number().min(0).max(23),
      min: z.coerce.number().min(0).max(59),
      label: z.string().min(3),
    })
    .strict(),
});

export const geoSchema = z.object({
  query: z
    .object({
      place: z.string().min(3),
    })
    .strict(),
});

export const matchMakingSchema = z.object({
  query: z
    .object({
      male_lat: z.coerce.number().min(-90).max(90),
      male_long: z.coerce.number().min(-180).max(180),
      male_dob: z.string().min(1),
      male_hour: z.coerce.number().min(0).max(23),
      male_min: z.coerce.number().min(0).max(59),

      female_lat: z.coerce.number().min(-90).max(90),
      female_long: z.coerce.number().min(-180).max(180),
      female_dob: z.string().min(1),
      female_hour: z.coerce.number().min(0).max(23),
      female_min: z.coerce.number().min(0).max(59),

      label: z.string().min(4),
    })
    .strict(),
});
