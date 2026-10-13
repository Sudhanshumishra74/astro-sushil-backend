import { z } from "zod";
export const availabilityZod = z.object({
  startTime: z.string(),
  endTime: z.string(),
  slotDuration: z.number().min(5),
  gap: z.number().min(0),
});