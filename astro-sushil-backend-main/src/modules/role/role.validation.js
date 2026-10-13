import { z } from "zod";

const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, "Invalid permission id");

// .strict() is a privilege-escalation guard: it rejects any request body
// that includes isSuperAdmin/isSystem/slug, so a client can never sneak
// those fields in through a create/update call.
export const createRoleSchema = z
  .object({
    name: z.string().min(2).max(50).trim(),
    description: z.string().max(300).optional(),
    permissions: z.array(objectIdString).default([]),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .strict();

export const updateRoleSchema = createRoleSchema.partial();

export const updateRoleStatusSchema = z
  .object({
    status: z.enum(["ACTIVE", "INACTIVE"]),
  })
  .strict();
