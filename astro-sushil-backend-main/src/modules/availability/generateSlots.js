import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const IST = "Asia/Kolkata";

export const generateSlots = (date, startTime, endTime, duration, gap = 0) => {
  if (!date || !startTime || !endTime) {
    throw new Error("Invalid slot inputs");
  }

  const formats = ["DD-MM-YYYY", "YYYY-MM-DD"];

  let parsedDate = null;

  for (const fmt of formats) {
    const d = dayjs.tz(date, fmt, IST, true);
    if (d.isValid()) {
      parsedDate = d;
      break;
    }
  }

  if (!parsedDate) {
    throw new Error("Invalid date format");
  }

  const finalDate = parsedDate.format("DD-MM-YYYY");

  // 🔥 normalize time → HH:mm
  const normalizeTime = (t) => {
    const [h, m] = t.toString().split(":");
    return `${h.padStart(2, "0")}:${(m || "00").padStart(2, "0")}`;
  };

  const startT = normalizeTime(startTime);
  const endT = normalizeTime(endTime);

  // 🔥 correct format now
  let start = dayjs.tz(
    `${finalDate} ${startT}`,
    "DD-MM-YYYY HH:mm",
    IST
  );

  let end = dayjs.tz(
    `${finalDate} ${endT}`,
    "DD-MM-YYYY HH:mm",
    IST
  );

  if (!start.isValid() || !end.isValid()) {
    throw new Error("Invalid time value (dayjs parse failed)");
  }

  const slots = [];

  while (start.isBefore(end)) {
    const slotEnd = start.add(duration, "minute");

    if (slotEnd.isAfter(end)) break;

    slots.push(
      `${start.format("HH:mm")}-${slotEnd.format("HH:mm")}` 
    );

    start = slotEnd.add(gap, "minute");
  }

  return slots;
};