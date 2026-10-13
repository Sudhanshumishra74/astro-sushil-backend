import { Otp } from "../modules/otp/otp.modal.js";
import { ApiError } from "../utils/ApiError.js";
import { emailTemplates } from "../utils/emailTemplates.js";
import sendEmail from "./sendEmail.js";
import { sendSmsLane } from "./smslane.js";
import { sendOtpWhatsapp } from "./sendWhatsapp.js";

const SMS_TEMPLATES = {
  signup: `Hello {#var#}, Your Signup OTP is {#var#}. ASTRO SUSHIL PRIVATE LIMITED`,
  login: `Hello {#var#}, Your login OTP is {#var#}. ASTRO SUSHIL PRIVATE LIMITED`,
  reset: `Hello {#var#}, Your password reset OTP is {#var#}. ASTRO SUSHIL PRIVATE LIMITED`,
};

const sendSMS = async (phone, otp, { purpose = "login", name = "Customer" } = {}) => {
  const template = SMS_TEMPLATES[purpose] || SMS_TEMPLATES.login;

  // template has two {#var#} placeholders: name, then OTP — replace in order
  const message = template.replace("{#var#}", name).replace("{#var#}", otp);

  try {
    const response = await sendSmsLane({ mobileNumber: phone, message });

    console.log("✅ SMSLane OTP Sent:", response);
    return response;
  } catch (error) {
    console.error("❌ SMSLane OTP Error:", error?.response?.data || error.message);
    throw new ApiError(500, "Failed to send OTP via SMS. Please try again or use email.");
  }
};

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const OTP_TTL = Number(process.env.OTP_TTL_MINUTES || 5);
const RATE_WINDOW = Number(process.env.OTP_RATE_LIMIT_WINDOW_MINUTES || 10);
const RATE_MAX = Number(process.env.OTP_RATE_LIMIT_MAX || 3);

const sendOtpService = async ({ identifier, type, channel, purpose, name }) => {
  if (!identifier || !type || !channel) {
    throw new ApiError(400, "Missing OTP params");
  }

  const windowStart = new Date(Date.now() - RATE_WINDOW * 60 * 1000);

  const count = await Otp.countDocuments({
    identifier,
    type,
    createdAt: { $gte: windowStart },
  });

  if (count >= RATE_MAX) {
    throw new ApiError(
      429,
      `Too many OTP requests. Try again after ${RATE_WINDOW} minutes`,
    );
  }

  const otp = generateOtp();

  // remove old OTPs
  await Otp.deleteMany({ identifier, type });

  const expiresAt = new Date(Date.now() + OTP_TTL * 60 * 1000);

  await Otp.create({
    identifier,
    channel,
    otp,
    type,
    expiresAt,
  });

  // send
  if (channel === "EMAIL") {
    const { subject, html } = emailTemplates.OTP({
      otp,
    });

    await sendEmail({
      to: identifier,
      subject,
      html,
    });
  }

  if (channel === "PHONE") {
    // Send on both channels — sendOtpWhatsapp never throws (logs and
    // resolves on failure), so a WhatsApp outage never blocks the SMS send.
    await Promise.all([
      sendSMS(identifier, otp, { purpose, name }),
      sendOtpWhatsapp({ phone: identifier, otp }),
    ]);
  }

  return otp;
};

const verifyOtpService = async ({ identifier, otp, type }) => {
  const record = await Otp.findOne({ identifier, otp, type });

  if (!record) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  await Otp.deleteMany({ identifier, type });

  return true;
};

export { sendOtpService, verifyOtpService };
