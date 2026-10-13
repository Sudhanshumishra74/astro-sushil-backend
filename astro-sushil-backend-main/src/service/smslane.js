import axios from "axios";

const SMSLANE_URL = "https://api.smslane.com/api/v2/SendSMS";

export const normalizeIndianMobile = (phone) => {
  if (!phone) return null;

  const digitsOnly = phone.toString().replace(/\D/g, "");
  const last10 = digitsOnly.slice(-10);

  return last10.length === 10 ? `91${last10}` : null;
};

// GSM-7 has no rupee sign, emoji, etc. — SMSLane silently swaps any such
// character for "?" unless the request is flagged as a Unicode message.
const needsUnicode = (str) => !/^[\x00-\x7F]*$/.test(str);

export const sendSmsLane = async ({ mobileNumber, message }) => {
  const normalized = normalizeIndianMobile(mobileNumber);

  if (!normalized) {
    throw new Error(`sendSmsLane: invalid mobile number "${mobileNumber}"`);
  }

  const params = {
    SenderId: process.env.SMSLANE_SENDER_ID,
    Message: message,
    MobileNumbers: normalized,
    ApiKey: process.env.SMSLANE_API_KEY,
    ClientId: process.env.SMSLANE_CLIENT_ID,
  };

  // SMSLane's v1 HTTP API (pushsms.aspx) requires dc=8 to send Unicode
  // content instead of GSM-7. Their v2 SendSMS endpoint used here isn't
  // publicly documented, so this is an untested best-effort carry-over of
  // that flag — confirm against the logged response below whether it
  // actually fixes the "?" substitution or needs a different param name.
  if (needsUnicode(message)) {
    params.dc = 8;
  }

  const response = await axios.get(SMSLANE_URL, { params });

  // SMSLane returns HTTP 200 even when it rejects a message (e.g. unicode
  // content sent without the provider's unicode flag, or a DLT template
  // mismatch) — axios never throws for that, so the response body is the
  // only place a rejection shows up. Log it so failures aren't silent.
  console.log(`SMSLane response for ${normalized}:`, response.data);

  return response.data;
};
