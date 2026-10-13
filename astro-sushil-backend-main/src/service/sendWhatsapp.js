import axios from "axios";

export const normalizePhone = (phone) => {
  if (!phone) return null;
  const cleaned = phone
    .toString()
    .trim()
    .replace(/[\s\-().]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
  // Legacy/local numbers stored without a country code — assume India,
  // since sign-up never enforced one before international support was added.
  if (/^\d{10}$/.test(cleaned)) return "+91" + cleaned;
  return cleaned;
};

const SUPPORT_CALL_PHONE = "+91 9125000013";

// Booking slots are stored as a "HH:mm-HH:mm" range string (see
// availability/generateSlots.js). Only in-person bookings show just the
// start time ("14:00"); audio/video keep the full range as before.
const formatSlotTime = (slot, mode) =>
  slot && mode === "in_person" ? String(slot).split("-")[0] : slot;

const capitalizeMode = (mode) => {
  if (!mode) return "-";
  return mode
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const buildCallInstructions = (mode) => {
  if (mode === "video") {
    return `On the day and time of your appointment, please make a WhatsApp or Botim video call to ${SUPPORT_CALL_PHONE}`;
  }
  if (mode === "in_person") {
    return `For meeting coordination, please call this number ${SUPPORT_CALL_PHONE}`;
  }
  return `Please call this number ${SUPPORT_CALL_PHONE} on the date and time of your appointment. (You may also use WhatsApp or Botim for voice call)`;
};

export const sendOrderWhatsapp = async ({
  name,
  phone,
  orderId,
  productName,
  status = "Confirmed",
  downloadLink,
}) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    console.warn(
      "sendOrderWhatsapp: skipped — phone number missing or invalid",
      { phone },
    );
    return;
  }

  try {
    const url =
      process.env.WHATCHIMP_API_URL ||
      "https://app.whatchimp.com/api/v1/whatsapp/send/template";

    const isDigital = !!downloadLink;

    const params = {
      apiToken: process.env.WHATCHIMP_API_TOKEN,
      phone_number_id: process.env.WHATCHIMP_PHONE_NUMBER_ID,
      template_id: isDigital
        ? process.env.WHATCHIMP_DIGITAL_ORDER_TEMPLATE_ID
        : process.env.WHATCHIMP_ORDER_TEMPLATE_ID,
      phone_number: normalizedPhone,
      "templateVariable-Username-1": name,
      "templateVariable-OrderID-2": orderId,
      "templateVariable-ProductorServiceName-3": productName,
      "templateVariable-OrderStatus-4": status,
      "templateVariable-Invoicelink-5": `${process.env.FRONTEND_URL}/dashboard?tab=orders`,
      ...(isDigital && {
        "templateVariable-Downloadlink-6": downloadLink,
      }),
    };

    const response = await axios.get(url, {
      params,
    });

    return response.data;
  } catch (err) {
    console.error("❌ WhatsApp Error:", err?.response?.data || err.message);
  }
};

export const sendOtpWhatsapp = async ({ phone, otp }) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    console.warn("sendOtpWhatsapp: skipped — phone number missing or invalid", {
      phone,
    });
    return;
  }

  try {
    const url =
      process.env.WHATCHIMP_API_URL ||
      "https://app.whatchimp.com/api/v1/whatsapp/send/template";

    const params = {
      apiToken: process.env.WHATCHIMP_API_TOKEN,
      phone_number_id: process.env.WHATCHIMP_PHONE_NUMBER_ID,
      template_id: process.env.WHATCHIMP_TEMPLATE_ID,
      phone_number: normalizedPhone,
      "templateVariable-otp-2": otp,
    };

    const response = await axios.get(url, { params });

    console.log("✅ WhatsApp OTP Sent:", response.data);
    return response.data;
  } catch (err) {
    console.error("❌ WhatsApp OTP Error:", err?.response?.data || err.message);
  }
};

export const sendReportOrderConfirmedWhatsapp = async ({ phone, userName }) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    console.warn(
      "sendReportOrderConfirmedWhatsapp: skipped — phone number missing or invalid",
      { phone },
    );
    return;
  }

  try {
    const url =
      process.env.WHATCHIMP_API_URL ||
      "https://app.whatchimp.com/api/v1/whatsapp/send/template";

    const response = await axios.get(url, {
      params: {
        apiToken: process.env.WHATCHIMP_API_TOKEN,
        phone_number_id: process.env.WHATCHIMP_PHONE_NUMBER_ID,
        template_id: process.env.WHATCHIMP_REPORT_ORDER_CONFIRMED_TEMPLATE_ID,
        phone_number: normalizedPhone,
        "templateVariable-User-Name-1": userName || "User",
      },
    });

    console.log("✅ WhatsApp Report Order Confirmed Sent:", response.data);
    return response.data;
  } catch (err) {
    console.error(
      "❌ WhatsApp Report Order Confirmed Error:",
      err?.response?.data || err.message,
    );
  }
};

export const sendReportReadyWhatsapp = async ({
  phone,
  reportName,
  reportUrl,
}) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    console.warn(
      "sendReportReadyWhatsapp: skipped — phone number missing or invalid",
      { phone },
    );
    return;
  }

  const url =
    process.env.WHATCHIMP_API_URL ||
    "https://app.whatchimp.com/api/v1/whatsapp/send/template";

  const params = {
    apiToken: process.env.WHATCHIMP_API_TOKEN,
    phone_number_id: process.env.WHATCHIMP_PHONE_NUMBER_ID,
    template_id: process.env.WHATCHIMP_REPORT_TEMPLATE_ID,
    phone_number: normalizedPhone,
    "templateVariable-ReportName-1": reportName,
    "templateVariable-Reportlink-2": reportUrl,
    "templateVariable-Invoicelink-3": `${process.env.FRONTEND_URL}/dashboard?tab=reports`,
  };

  // Deliberately not caught here: handleReportReady needs to know when this
  // fails so it doesn't mark the report as sent when it wasn't (see
  // isReportSent bug where WhatChimp failures were swallowed and silently
  // treated as success).
  const response = await axios.get(url, { params });

  return response.data;
};

export const sendBookingConfirmedWhatsapp = async ({
  phone,
  userName,
  consultationTitle,
  date,
  mode,
  slot,
  amount,
  includes = [],
  supportPhone,
}) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    console.warn(
      "sendBookingConfirmedWhatsapp: skipped — phone number missing or invalid",
      { phone },
    );
    return;
  }

  console.log("PHONE", normalizedPhone);

  try {
    const url =
      process.env.WHATCHIMP_API_URL ||
      "https://app.whatchimp.com/api/v1/whatsapp/send/template";

    const params = {
      apiToken: process.env.WHATCHIMP_API_TOKEN,
      phone_number_id: process.env.WHATCHIMP_PHONE_NUMBER_ID,
      template_id: process.env.WHATCHIMP_BOOKING_CONFIRMED_TEMPLATE_ID,
      phone_number: normalizedPhone,
      "templateVariable-Username-1": userName || "User",
      "templateVariable-Consultation-2": consultationTitle || "Consultation",
      "templateVariable-Date-3": date || "-",
      "templateVariable-ServiceMode-4": capitalizeMode(mode),
      "templateVariable-slot-5": formatSlotTime(slot, mode) || "-",
      "templateVariable-ordervalue-6": amount || 0,
      "templateVariable-Include-7":
        includes.length > 0 ? includes.join(", ") : "-",
      "templateVariable-CallInstructions-8": buildCallInstructions(
        mode,
        supportPhone,
      ),
      "templateVariable-Invoicelink-9": `${process.env.FRONTEND_URL}/dashboard?tab=consultations`,
    };

    const response = await axios.get(url, { params });
    console.log("✅ WhatsApp Booking Confirmed Sent:", response.data);
    return response.data;
  } catch (err) {
    console.error(
      "❌ WhatsApp Booking Confirmed Error:",
      err?.response?.data || err.message,
    );
  }
};

export const sendBookingUpdatedWhatsapp = async ({
  phone,
  userName,
  consultationTitle,
  date,
  slot,
  serviceMode,
  amount,
  includes = [],
  supportPhone,
}) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    console.warn(
      "sendBookingUpdatedWhatsapp: skipped — phone number missing or invalid",
      { phone },
    );
    return;
  }

  try {
    const url =
      process.env.WHATCHIMP_API_URL ||
      "https://app.whatchimp.com/api/v1/whatsapp/send/template";

    const params = {
      apiToken: process.env.WHATCHIMP_API_TOKEN,
      phone_number_id: process.env.WHATCHIMP_PHONE_NUMBER_ID,
      template_id: process.env.WHATCHIMP_BOOKING_UPDATED_TEMPLATE_ID,
      phone_number: normalizedPhone,
      "templateVariable-Username-1": userName || "User",
      "templateVariable-Consultation-2": consultationTitle || "Consultation",
      "templateVariable-Date-3": date || "-",
      "templateVariable-ServiceMode-4": capitalizeMode(serviceMode),
      "templateVariable-slot-5": formatSlotTime(slot, serviceMode) || "-",
      "templateVariable-ordervalue-6": amount || 0,
      "templateVariable-Include-7":
        includes.length > 0 ? includes.join(", ") : "-",
      "templateVariable-CallInstructions-8": buildCallInstructions(
        serviceMode,
        supportPhone,
      ),
      "templateVariable-Invoicelink-9": `${process.env.FRONTEND_URL}/dashboard?tab=consultations`,
    };

    const response = await axios.get(url, { params });

    console.log("✅ WhatsApp Booking Updated Sent:", response.data);

    return response.data;
  } catch (err) {
    console.error(
      "❌ WhatsApp Booking Updated Error:",
      err?.response?.data || err.message,
    );
  }
};

export const sendConsultationReminderWhatsapp = async ({
  phone,
  userName,
  consultationTitle,
  date,
  slot,
  mode,
}) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    console.warn(
      "sendConsultationReminderWhatsapp: skipped — phone number missing or invalid",
      { phone },
    );
    return;
  }

  try {
    const url =
      process.env.WHATCHIMP_API_URL ||
      "https://app.whatchimp.com/api/v1/whatsapp/send/template";

    const params = {
      apiToken: process.env.WHATCHIMP_API_TOKEN,
      phone_number_id: process.env.WHATCHIMP_PHONE_NUMBER_ID,
      template_id: process.env.WHATCHIMP_CONSULTATION_REMINDER_TEMPLATE_ID,
      phone_number: normalizedPhone,
      "templateVariable-User-Name-1": userName,
      "templateVariable-consultationTitle-2": consultationTitle,
      "templateVariable-Date-3": `${date} at ${formatSlotTime(slot, mode)}`,
    };

    const response = await axios.get(url, {
      params,
    });

    return response.data;
  } catch (err) {
    console.error("❌ WhatsApp Error:", err?.response?.data || err.message);
  }
};

export const sendConsultationRescheduleWhatsapp = async ({
  phone,
  userName,
  consultationTitle,
  date,
  slot,
  serviceMode,
  amount,
  includes = [],
  supportPhone,
}) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    console.warn(
      "sendConsultationRescheduleWhatsapp: skipped — phone number missing or invalid",
      { phone },
    );
    return;
  }

  try {
    const url =
      process.env.WHATCHIMP_API_URL ||
      "https://app.whatchimp.com/api/v1/whatsapp/send/template";

    const params = {
      apiToken: process.env.WHATCHIMP_API_TOKEN,
      phone_number_id: process.env.WHATCHIMP_PHONE_NUMBER_ID,
      template_id: process.env.WHATCHIMP_CONSULTATION_RESCHEDULE_TEMPLATE_ID,

      phone_number: normalizedPhone,

      "templateVariable-Username-1": userName || "User",
      "templateVariable-Consultation-2": consultationTitle || "Consultation",
      "templateVariable-Date-3": date || "-",
      "templateVariable-ServiceMode-4": capitalizeMode(serviceMode),
      "templateVariable-slot-5": formatSlotTime(slot, serviceMode) || "-",
      "templateVariable-ordervalue-6": amount || 0,
      "templateVariable-Include-7":
        includes.length > 0 ? includes.join(", ") : "-",
      "templateVariable-CallInstructions-8": buildCallInstructions(
        serviceMode,
        supportPhone,
      ),
    };

    const response = await axios.get(url, {
      params,
    });

    console.log("✅ WhatsApp Reschedule Sent:", response.data);

    return response.data;
  } catch (err) {
    console.error(
      "❌ WhatsApp Reschedule Error:",
      err?.response?.data || err.message,
    );
  }
};
