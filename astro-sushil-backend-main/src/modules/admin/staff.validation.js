import { z } from "zod";

const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, "Invalid role id");

export const createStaffSchema = z
  .object({
    fullName: z.string().min(2).max(80),
    email: z.string().email("Invalid email"),
    username: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dots, underscores and hyphens"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    phoneNumber: z.string().min(10).max(15).optional(),
    designation: z.string().max(80).optional(),
    roleId: objectIdString,
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  })
  .strict();

export const updateStaffSchema = z
  .object({
    fullName: z.string().min(2).max(80),
    phoneNumber: z.string().min(10).max(15),
    designation: z.string().max(80),
    website: z.string().url(),
    portfolioLink: z.string().url(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
  })
  .partial()
  .strict();

export const updateStaffRoleSchema = z
  .object({
    roleId: objectIdString,
  })
  .strict();

export const updateStaffStatusSchema = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED"]),
  })
  .strict();

export const resetStaffPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .strict();
