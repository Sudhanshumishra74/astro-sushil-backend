import { z } from "zod";

const email = z.string().email("Invalid email");
const password = z.string().min(6, "Password must be at least 6 characters");

const phone = z.string().min(10).max(15).optional();

export const loginAdminSchema = z
  .object({
    email,
    username: z.string().min(3).optional(),
    password,
  })
  .refine((data) => data.email || data.username, {
    message: "Either email or username is required",
  });

export const updateAdminSchema = z
  .object({
    fullName: z.string().min(2),
    phoneNumber: z.string().min(10).max(15),
    designation: z.string(),
    website: z.string().url(),
    portfolioLink: z.string().url(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
  })
  .partial();

export const changePasswordSchema = z.object({
  oldPassword: password,
  newPassword: password,
});

export const sendOtpSchema = z.object({
  identifier: z.string().min(3),
  channel: z.enum(["EMAIL", "PHONE"]),
  type: z.enum(["VERIFY", "LOGIN", "RESET"]),
});

export const verifyOtpSchema = z.object({
  identifier: z.string().min(3),
  otp: z.string().length(6),
  type: z.enum(["VERIFY", "LOGIN", "RESET"]),
});
