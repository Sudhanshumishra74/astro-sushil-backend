import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export const IST = "Asia/Kolkata";

export const nowIST = () => dayjs().tz(IST);


export const parseDateIST = (date) => {
  if (!date) return null;

  const formats = [
    "DD-MM-YYYY",
    "YYYY-MM-DD",
    "MM/DD/YYYY",
    "DD/MM/YYYY",
    "YYYY/MM/DD",
  ];

  let parsed = null;

  for (const fmt of formats) {
    // Strict-mode parsing throws (rather than yielding an invalid dayjs
    // instance) when `date` doesn't match `fmt` — catch it so the loop can
    // fall through to the next candidate format instead of aborting on the
    // first mismatch.
    try {
      const d = dayjs.tz(date, fmt, IST, true);
      if (d.isValid()) {
        parsed = d;
        break;
      }
    } catch {
      // try next format
    }
  }

  if (!parsed) {
    parsed = dayjs(date).tz(IST);
  }

  return parsed.isValid() ? parsed.startOf("day") : null;
};


export const normalizeDate = (date) => {
  const parsed = parseDateIST(date);
  return parsed ? parsed.format("DD-MM-YYYY") : null;
};