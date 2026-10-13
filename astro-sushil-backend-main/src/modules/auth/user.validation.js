import { z } from "zod";

const email = z.string().email("Invalid email");

const password = z.string().min(6, "Password must be at least 6 characters");

const phone = z.string().regex(/^\+?[1-9]\d{6,14}$/, "Enter a valid phone number (7–15 digits, with optional + country code)");

const identifier = z
  .string()
  .min(3)
  .refine((val) => val.includes("@") || /^\+?[1-9]\d{6,14}$/.test(val), {
    message: "Must be a valid email or phone number",
  });

/* ================= REGISTER ================= */

export const registerUserSchema = z.object({
  firstName: z
    .string()
    .min(2)
    .regex(/^[A-Za-z ]+$/, "Only alphabets allowed"),

  lastName: z.string().optional(),

  email,

  phoneNumber: phone,
});

export const loginUserSchema = z.object({
  identifier: z
    .string()
    .min(3)
    .refine((val) => val.includes("@") || /^\+?[1-9]\d{6,14}$/.test(val), {
      message: "Must be a valid email or phone number",
    }),

  channel: z.enum(["EMAIL", "PHONE"]),

  type: z.enum(["AUTH"]),
});

export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .min(2)
    .regex(/^[A-Za-z ]+$/, "Only alphabets allowed")
    .optional(),

  lastName: z.string().optional(),

  email: email.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email").optional(),

  username: z
    .string()
    .min(3)
    .regex(/^[a-zA-Z0-9_]+$/, "Invalid username")
    .optional(),

  phoneNumber: phone.optional(),

  birthPlace: z.string().optional(),
  birthTime: z.string().optional(),
  gender: z.string().optional(),
  dob: z.string().optional(),

  skill: z.string().optional(),
  timezone: z.string().optional(),
  bio: z.string().optional(),
  displayName: z.string().optional(),
});

export const updateSocialSchema = z.object({
  linkedin: z.string().url().optional(),
  twitter: z.string().url().optional(),
  github: z.string().url().optional(),
  website: z.string().url().optional(),
});

export const sendOtpSchema = z.object({
  identifier,
  channel: z.enum(["EMAIL", "PHONE"]),
  type: z.enum(["AUTH"]),
});

export const verifyAuthSchema = z.object({
  identifier,
  otp: z.string().regex(/^[0-9]{6}$/, "OTP must be 6 digits"),
  type: z.enum(["AUTH"]),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(6, "Old password required"),

  newPassword: z
    .string()
    .min(6)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain number"),
});

export const forgotPasswordSchema = z.object({
  identifier,
});

export const resetPasswordSchema = z.object({
  identifier,

  otp: z.string().regex(/^[0-9]{6}$/, "OTP must be 6 digits"),

  newPassword: z
    .string()
    .min(6)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain number"),
});
