import {
  nowIST,
  addDaysIST,
  formatDateIST,
} from "../../utils/time.js";

export const generateSlots = (doc) => {
  const slots = [];

  let current = nowIST();
  const endDate = addDaysIST(current, doc.responseDays || 15);

  while (current.isBefore(endDate) || current.isSame(endDate)) {
    const dateStr = formatDateIST(current);

    if (doc.unavailableDates?.includes(dateStr)) {
      current = current.add(1, "day");
      continue;
    }

    // ✅ SAFE TIME PARSING (NO STRING PARSE)
    const [sh, sm] = doc.startTime.split(":").map(Number);
    const [eh, em] = doc.endTime.split(":").map(Number);

    let time = current.hour(sh).minute(sm).second(0);
    const end = current.hour(eh).minute(em).second(0);

    while (
      time.add(doc.duration, "minute").isBefore(end) ||
      time.add(doc.duration, "minute").isSame(end)
    ) {
      slots.push({
        date: dateStr,
        startTime: time.format("HH:mm"),
        endTime: time.add(doc.duration, "minute").format("HH:mm"),
        isBooked: false,
      });

      time = time.add(doc.duration + doc.gap, "minute");
    }

    current = current.add(1, "day");
  }

  return slots;
};