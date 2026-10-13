import axios from "axios";

const AISENSY_API_URL =
  process.env.AISENSY_API_URL ||
  "https://backend.aisensy.com/campaign/t1/api/v2";

export const normalizeAisensyPhone = (phone) => {
  if (!phone) return null;
  const digits = phone.toString().replace(/[^\d]/g, "");
  if (!digits) return null;
  return digits;
};

const SUPPORT_CALL_PHONE = "+91 9125000013";

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

const sendAisensyCampaign = async ({
  campaignName,
  phone,
  templateParams,
  buttons,
}) => {
  const response = await axios.post(AISENSY_API_URL, {
    apiKey: process.env.AISENSY_API_KEY,
    campaignName,
    destination: phone,
    userName: process.env.AISENSY_SENDER_NAME || "Astro Sushil",
    templateParams,
    ...(buttons && { buttons }),
  });

  return response.data;
};

export const sendOrderWhatsapp = async ({
  name,
  phone,
  orderId,
  productName,
  status = "Confirmed",
  downloadLink,
}) => {
  const normalizedPhone = normalizeAisensyPhone(phone);
  if (!normalizedPhone) {
    console.warn(
      "sendOrderWhatsapp (AiSensy): skipped — phone number missing or invalid",
      { phone },
    );
    return;
  }

  try {
    const isDigital = !!downloadLink;

    const campaignName = isDigital
      ? process.env.AISENSY_DIGITAL_ORDER_CAMPAIGN
      : process.env.AISENSY_ORDER_CAMPAIGN;

    const templateParams = [
      name,
      orderId,
      productName,
      status,
      `${process.env.FRONTEND_URL}/dashboard?tab=orders`,
      ...(isDigital ? [downloadLink] : []),
    ];

    const response = await sendAisensyCampaign({
      campaignName,
      phone: normalizedPhone,
      templateParams,
    });

    return response;
  } catch (err) {
    console.error(
      "❌ AiSensy WhatsApp Error:",
      err?.response?.data || err.message,
    );
  }
};

export const sendOtpWhatsapp = async ({ phone, otp }) => {
  const normalizedPhone = normalizeAisensyPhone(phone);
  if (!normalizedPhone) {
    console.warn(
      "sendOtpWhatsapp (AiSensy): skipped — phone number missing or invalid",
      { phone },
    );
    return;
  }

  try {
    const response = await sendAisensyCampaign({
      campaignName: process.env.AISENSY_OTP_CAMPAIGN,
      phone: normalizedPhone,
      templateParams: [otp],
      // Authentication templates render a "Copy Code" button whose parameter
      // must also carry the OTP — without this, WhatsApp silently drops the
      // send even though AiSensy still counts the contact into the audience.
      buttons: [
        {
          type: "button",
          sub_type: "url",
          index: 0,
          parameters: [{ type: "text", text: otp }],
        },
      ],
    });

    console.log("✅ AiSensy WhatsApp OTP Sent:", response);
    return response;
  } catch (err) {
    console.error(
      "❌ AiSensy WhatsApp OTP Error:",
      err?.response?.data || err.message,
    );
  }
};

export const sendReportOrderConfirmedWhatsapp = async ({ phone, userName }) => {
  const normalizedPhone = normalizeAisensyPhone(phone);
  if (!normalizedPhone) {
    console.warn(
      "sendReportOrderConfirmedWhatsapp (AiSensy): skipped — phone number missing or invalid",
      { phone },
    );
    return;
  }

  try {
    const response = await sendAisensyCampaign({
      campaignName: process.env.AISENSY_REPORT_ORDER_CONFIRMED_CAMPAIGN,
      phone: normalizedPhone,
      templateParams: [userName || "User"],
    });

    console.log("✅ AiSensy WhatsApp Report Order Confirmed Sent:", response);
    return response;
  } catch (err) {
    console.error(
      "❌ AiSensy WhatsApp Report Order Confirmed Error:",
      err?.response?.data || err.message,
    );
  }
};

export const sendReportReadyWhatsapp = async ({
  name,
  phone,
  reportName,
  reportUrl,
}) => {
  const normalizedPhone = normalizeAisensyPhone(phone);
  if (!normalizedPhone) {
    console.warn(
      "sendReportReadyWhatsapp (AiSensy): skipped — phone number missing or invalid",
      { phone },
    );
    return;
  }

  try {
    const response = await sendAisensyCampaign({
      campaignName: process.env.AISENSY_REPORT_CAMPAIGN,
      phone: normalizedPhone,
      templateParams: [
        name,
        reportName,
        reportUrl,
        `${process.env.FRONTEND_URL}/dashboard?tab=reports`,
      ],
    });

    return response;
  } catch (err) {
    console.error(
      "❌ AiSensy WhatsApp Error:",
      err?.response?.data || err.message,
    );
  }
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
  const normalizedPhone = normalizeAisensyPhone(phone);
  if (!normalizedPhone) {
    console.warn(
      "sendBookingConfirmedWhatsapp (AiSensy): skipped — phone number missing or invalid",
      { phone },
    );
    return;
  }

  try {
    const templateParams = [
      userName || "User",
      consultationTitle || "Consultation",
      date || "-",
      capitalizeMode(mode),
      formatSlotTime(slot, mode) || "-",
      String(amount || 0),
      includes.length > 0 ? includes.join(", ") : "-",
      buildCallInstructions(mode, supportPhone),
      `${process.env.FRONTEND_URL}/dashboard?tab=consultations`,
    ];

    const response = await sendAisensyCampaign({
      campaignName: process.env.AISENSY_BOOKING_CONFIRMED_CAMPAIGN,
      phone: normalizedPhone,
      templateParams,
    });

    console.log("✅ AiSensy WhatsApp Booking Confirmed Sent:", response);
    return response;
  } catch (err) {
    console.error(
      "❌ AiSensy WhatsApp Booking Confirmed Error:",
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
  const normalizedPhone = normalizeAisensyPhone(phone);
  if (!normalizedPhone) {
    console.warn(
      "sendBookingUpdatedWhatsapp (AiSensy): skipped — phone number missing or invalid",
      { phone },
    );
    return;
  }

  try {
    const templateParams = [
      userName || "User",
      consultationTitle || "Consultation",
      date || "-",
      capitalizeMode(serviceMode),
      formatSlotTime(slot, serviceMode) || "-",
      String(amount || 0),
      includes.length > 0 ? includes.join(", ") : "-",
      buildCallInstructions(serviceMode, supportPhone),
      `${process.env.FRONTEND_URL}/dashboard?tab=consultations`,
    ];

    const response = await sendAisensyCampaign({
      campaignName: process.env.AISENSY_BOOKING_UPDATED_CAMPAIGN,
      phone: normalizedPhone,
      templateParams,
    });

    console.log("✅ AiSensy WhatsApp Booking Updated Sent:", response);
    return response;
  } catch (err) {
    console.error(
      "❌ AiSensy WhatsApp Booking Updated Error:",
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
  const normalizedPhone = normalizeAisensyPhone(phone);
  if (!normalizedPhone) {
    console.warn(
      "sendConsultationReminderWhatsapp (AiSensy): skipped — phone number missing or invalid",
      { phone },
    );
    return;
  }

  try {
    const response = await sendAisensyCampaign({
      campaignName: process.env.AISENSY_CONSULTATION_REMINDER_CAMPAIGN,
      phone: normalizedPhone,
      templateParams: [
        userName,
        consultationTitle,
        `${date} at ${formatSlotTime(slot, mode)}`,
      ],
    });

    return response;
  } catch (err) {
    console.error(
      "❌ AiSensy WhatsApp Error:",
      err?.response?.data || err.message,
    );
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
  const normalizedPhone = normalizeAisensyPhone(phone);
  if (!normalizedPhone) {
    console.warn(
      "sendConsultationRescheduleWhatsapp (AiSensy): skipped — phone number missing or invalid",
      { phone },
    );
    return;
  }

  try {
    const templateParams = [
      userName || "User",
      consultationTitle || "Consultation",
      date || "-",
      capitalizeMode(serviceMode),
      formatSlotTime(slot, serviceMode) || "-",
      String(amount || 0),
      includes.length > 0 ? includes.join(", ") : "-",
      buildCallInstructions(serviceMode, supportPhone),
    ];

    const response = await sendAisensyCampaign({
      campaignName: process.env.AISENSY_CONSULTATION_RESCHEDULE_CAMPAIGN,
      phone: normalizedPhone,
      templateParams,
    });

    console.log("✅ AiSensy WhatsApp Reschedule Sent:", response);
    return response;
  } catch (err) {
    console.error(
      "❌ AiSensy WhatsApp Reschedule Error:",
      err?.response?.data || err.message,
    );
  }
};
