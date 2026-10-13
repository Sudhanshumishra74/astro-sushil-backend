import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseDateIST, normalizeDate, nowIST } from "../../utils/time.js";
import { Booking } from "../booking/booking.model.js";
import { Consultation } from "../consultation/consultation.modal.js";
import { Availability } from "./availability.model.js";
import { availabilityZod } from "./availability.validation.js";
import { generateSlots } from "./generateSlots.js";
import { Schedule } from "./schedule.model.js";

export const setAvailability = asyncHandler(async (req, res) => {
  const result = availabilityZod.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((e) => e.message);
    throw new ApiError(400, errors.join(", "));
  }

  const availability = await Availability.findOneAndUpdate({}, result.data, {
    new: true,
    upsert: true,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, availability, "Availability updated"));
});
export const getAvailability = asyncHandler(async (req, res) => {
  const availability = await Availability.findOne();

  return res
    .status(200)
    .json(new ApiResponse(200, availability, "Availability fetched"));
});

export const blockFullDay = asyncHandler(async (req, res) => {
  const { date } = req.body;

  if (!date) throw new ApiError(400, "Date required");

  const schedule = await Schedule.findOneAndUpdate(
    { date },
    { isBlocked: true, blockedSlots: [] },
    { new: true, upsert: true },
  );

  return res.status(200).json(new ApiResponse(200, schedule, "Day blocked"));
});

export const unblockFullDay = asyncHandler(async (req, res) => {
  const { date } = req.body;

  const schedule = await Schedule.findOneAndUpdate(
    { date },
    { isBlocked: false },
    { new: true },
  );

  return res.status(200).json(new ApiResponse(200, schedule, "Day unblocked"));
});

export const blockSlots = asyncHandler(async (req, res) => {
  const { date, slots } = req.body;

  if (!date || !slots?.length) {
    throw new ApiError(400, "Date & slots required");
  }

  const schedule = await Schedule.findOneAndUpdate(
    { date },
    {
      $addToSet: { blockedSlots: { $each: slots } },
    },
    { new: true, upsert: true },
  );

  return res.status(200).json(new ApiResponse(200, schedule, "Slots blocked"));
});

export const unblockSlots = asyncHandler(async (req, res) => {
  const { date, slots } = req.body;

  const schedule = await Schedule.findOneAndUpdate(
    { date },
    {
      $pull: { blockedSlots: { $in: slots } },
    },
    { new: true },
  );

  return res
    .status(200)
    .json(new ApiResponse(200, schedule, "Slots unblocked"));
});

export const getScheduleByDate = asyncHandler(async (req, res) => {
  const { date } = req.query;

  const schedule = await Schedule.findOne({ date });

  return res
    .status(200)
    .json(new ApiResponse(200, schedule, "Schedule fetched"));
});



export const getBlockedDatesByMonth = asyncHandler(async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
    throw new ApiError(400, "Month and year are required");
  }

  // month: 1–12 → convert to 2 digit
  const m = String(month).padStart(2, "0");

  // date format: "DD-MM-YYYY"
  const start = `01-${m}-${year}`;
  const end = `31-${m}-${year}`;

  const schedules = await Schedule.find({
    isBlocked: true,
    date: { $gte: start, $lte: end },
  }).select("date");

  const dates = schedules.map((s) => s.date);

  return res
    .status(200)
    .json(new ApiResponse(200, dates, "Blocked dates fetched"));
});

async function fetchSlots(req, res, { isAdmin = false } = {}) {
  const { date, consultationId } = req.query;

  if (!date) {
    throw new ApiError(400, "Date is required");
  }

  const parsedDate = parseDateIST(date);
  if (!parsedDate || !parsedDate.isValid()) {
    throw new ApiError(400, "Invalid date format");
  }

  const normalizedDate = parsedDate.format("DD-MM-YYYY");

  const normalize = (s) => s?.toString().trim().replace(/\s+/g, "");

  // Convert "HH:mm-HH:mm" slot string to { start, end } in minutes since midnight
  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const parseSlot = (s) => {
    const [startStr, endStr] = normalize(s).split("-");
    return { start: toMinutes(startStr), end: toMinutes(endStr) };
  };
  const overlaps = (slotA, slotB) => {
    const a = parseSlot(slotA);
    const b = parseSlot(slotB);
    return a.start < b.end && b.start < a.end;
  };

  // Fetch consultation once if provided — used for responseDays + slot duration
  let consultation = null;
  if (consultationId) {
    consultation = await Consultation.findById(consultationId);
    if (!consultation) {
      throw new ApiError(404, "Consultation not found");
    }
  }

  // responseDays check — customers only
  if (!isAdmin && consultation) {
    const allowedFromDate = nowIST()
      .add(consultation.responseDays || 0, "day")
      .startOf("day");

    if (parsedDate.isBefore(allowedFromDate)) {
      return res.status(200).json(
        new ApiResponse(
          200,
          [],
          `Slots available from ${allowedFromDate.format("DD-MM-YYYY")}`
        )
      );
    }
  }

  const availability = await Availability.findOne();

  if (
    !availability ||
    !availability.startTime ||
    !availability.endTime ||
    !availability.slotDuration
  ) {
    throw new ApiError(400, "Invalid availability configuration");
  }

  // Use the consultation's own duration when provided; fall back to global setting
  const slotDuration = consultation?.duration || availability.slotDuration;

  let allSlots = [];
  try {
    allSlots = generateSlots(
      normalizedDate,
      availability.startTime,
      availability.endTime,
      slotDuration,
      availability.gap
    );
  } catch (err) {
    console.error("Slot generation error:", err.message);
    throw new ApiError(500, "Failed to generate slots");
  }

  const schedule =
    (await Schedule.findOne({ date: normalizedDate })) || {
      isBlocked: false,
      blockedSlots: [],
    };

  // Blocked-day and blocked-slot filters — customers only
  if (!isAdmin) {
    if (schedule.isBlocked) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No slots available (day blocked)"));
    }

    const blockedSlotsList = (schedule.blockedSlots || []).map(normalize);
    const bookedDocs = await Booking.find({ date: normalizedDate, status: "booked", isDeleted: false }).select("slot");
    const bookedSlotsList = bookedDocs.map((b) => normalize(b.slot));

    return res.status(200).json(
      new ApiResponse(
        200,
        allSlots.filter((slot) => {
          if (blockedSlotsList.some((b) => overlaps(slot, b))) return false;
          return !bookedSlotsList.some((b) => overlaps(slot, b));
        }),
        "Slots fetched successfully"
      )
    );
  }

  // Admin: show all slots but mark any that overlap any booking on that date
  const bookedDocs = await Booking.find({ date: normalizedDate, status: "booked", isDeleted: false }).select("slot");
  const bookedSlotsList = bookedDocs.map((b) => normalize(b.slot));

  return res.status(200).json(
    new ApiResponse(
      200,
      allSlots.map((slot) => ({
        slot,
        status: bookedSlotsList.some((b) => overlaps(slot, b)) ? "booked" : "available",
      })),
      "Slots fetched successfully"
    )
  );
}

export const getAvailableSlots = asyncHandler((req, res) =>
  fetchSlots(req, res, { isAdmin: false })
);

export const getAdminAvailableSlots = asyncHandler((req, res) =>
  fetchSlots(req, res, { isAdmin: true })
);