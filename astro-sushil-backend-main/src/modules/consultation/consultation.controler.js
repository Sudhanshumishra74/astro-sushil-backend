import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Availability } from "../availability/availability.model.js";
import { Schedule } from "../availability/schedule.model.js";
import { Booking } from "../booking/booking.model.js";
import { Consultation } from "./consultation.modal.js";
import { consultationZod } from "./consultation.validation.js";
import { computeGst } from "../../common/taxEngine.js";
import dayjs from "dayjs";

const formatZodError = (err) => {
  return (err?.issues || []).map((e) => ({
    field: e.path.join("."),
    message: e.message,
  }));
};

// priceWithGst is only persisted on save — for records read straight from
// the DB without ever being re-saved since GST was added, it sits at the
// schema-default 0. Recompute it fresh on every read so no data migration
// is ever needed and stale/never-saved records still show the right price.
const withFreshModePricing = (consultation) => {
  const obj =
    typeof consultation.toObject === "function"
      ? consultation.toObject()
      : consultation;

  return {
    ...obj,
    modes: (obj.modes || []).map((m) => ({
      ...m,
      priceWithGst: computeGst(m.price?.inr || 0, m.gst).total,
    })),
  };
};

export const createConsultation = asyncHandler(async (req, res) => {
  const parsed = consultationZod.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Validation failed", formatZodError(parsed.error));
  }

  const data = parsed.data;

  const consultation = await Consultation.create({
    ...data,
    responseDays: data.responseDays ?? 0,
    type: data.type ?? "normal",
    isActive: true,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, consultation, "Consultation created"));
});

export const updateConsultation = asyncHandler(async (req, res) => {
  const parsed = consultationZod.partial().safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Validation failed", formatZodError(parsed.error));
  }

  const doc = await Consultation.findById(req.params.id);

  if (!doc) {
    throw new ApiError(404, "Consultation not found");
  }

  const data = parsed.data;

  if (data.modes) {
    const existingModes = doc.modes || [];

    const modeMap = new Map(existingModes.map((m) => [m.mode, m]));

    data.modes.forEach((incoming) => {
      if (incoming._delete === true) {
        modeMap.delete(incoming.mode);
        return;
      }

      const updated = {
        ...modeMap.get(incoming.mode)?._doc,
        ...incoming,
        price: incoming.price
          ? {
              ...incoming.price,
            }
          : modeMap.get(incoming.mode)?.price,
        gst: incoming.gst
          ? {
              ...incoming.gst,
            }
          : modeMap.get(incoming.mode)?.gst,
      };

      modeMap.set(incoming.mode, updated);
    });

    doc.modes = Array.from(modeMap.values());
  }

  const fields = [
    "title",
    "type",
    "description",
    "responseDays",
    "includes",
    "duration",
    "priceLabel",
    "note",
    "isActive",
  ];

  fields.forEach((field) => {
    if (data[field] !== undefined) {
      doc[field] = data[field];
    }
  });

  await doc.save();

  return res.json(
    new ApiResponse(200, doc, "Consultation updated successfully"),
  );
});

export const getConsultations = asyncHandler(async (req, res) => {
  const { type } = req.query;

  const filter = { isActive: true };

  if (type) {
    filter.type = type;
  }

  const consultations = await Consultation.aggregate([
    {
      $match: filter,
    },
    {
      $addFields: {
        minPrice: {
          $min: "$modes.price.inr",
        },
      },
    },
    {
      $sort: {
        minPrice: 1,
      },
    },
  ]);

  const withPricing = consultations.map(withFreshModePricing);

  return res.json(new ApiResponse(200, withPricing, "Consultations fetched"));
});

export const getConsultationsAdminAll = asyncHandler(async (req, res) => {
  const consultations = await Consultation.find().sort({ createdAt: -1 });
  const withPricing = consultations.map(withFreshModePricing);
  return res.json(new ApiResponse(200, withPricing, "Consultations fetched"));
});

export const getConsultationsAdmin = asyncHandler(async (req, res) => {
  const consultations = await Consultation.find().sort({ createdAt: -1 });

  const flattened = consultations.flatMap((c) =>
    c.modes.map((m) => ({
      _id: `${c._id}_${m.mode}`, // unique for UI
      consultationId: c._id,

      title: c.title,
      type: c.type,

      mode: m.mode,
      price: m.price.inr,
      priceWithGst: computeGst(m.price?.inr || 0, m.gst).total,
      gst: m.gst,

      duration: c.duration,
      // isActive: c.isActive,

      createdAt: c.createdAt,
    })),
  );

  return res.json(
    new ApiResponse(200, flattened, "Admin consultations fetched"),
  );
});

export const deleteConsultation = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Consultation ID is required");
  }

  const consultation = await Consultation.findById(id);

  if (!consultation) {
    throw new ApiError(404, "Consultation not found");
  }

  await consultation.deleteOne();

  return res.json(
    new ApiResponse(200, null, "Consultation deleted successfully"),
  );
});

export const getConsultationById = asyncHandler(async (req, res) => {
  const consultation = await Consultation.findById(req.params.id);

  if (!consultation) {
    throw new ApiError(404, "Consultation not found");
  }

  return res.json(
    new ApiResponse(200, withFreshModePricing(consultation), "Consultation fetched"),
  );
});
export const getBlockedDates = asyncHandler(async (req, res) => {
  const consultation = await Consultation.findById(req.params.id);

  if (!consultation) {
    throw new ApiError(404, "Consultation not found");
  }

  return res.json(
    new ApiResponse(
      200,
      consultation.unavailableDates,
      "Blocked dates fetched",
    ),
  );
});

export const unblockDate = asyncHandler(async (req, res) => {
  const { consultationId, date } = req.body;

  if (!consultationId || !date) {
    throw new ApiError(400, "consultationId and date required");
  }

  const consultation = await Consultation.findById(consultationId);

  if (!consultation) {
    throw new ApiError(404, "Consultation not found");
  }

  consultation.unavailableDates = consultation.unavailableDates.filter(
    (d) => d !== date,
  );

  await consultation.save();

  return res.json(
    new ApiResponse(200, consultation.unavailableDates, "Date unblocked"),
  );
});

export const getSlots = asyncHandler(async (req, res) => {
  const { consultationId, date } = req.query;

  if (!consultationId || !date) {
    throw new ApiError(400, "consultationId and date are required");
  }

  const consultation = await Consultation.findById(consultationId);

  if (!consultation) {
    throw new ApiError(404, "Consultation not found");
  }

  const selectedDate = dayjs(date, "YYYY-MM-DD", true).startOf("day");

  if (!selectedDate.isValid()) {
    throw new ApiError(400, "Invalid date format");
  }

  const minimumDate = dayjs()
    .add(consultation.responseDays, "day")
    .startOf("day");

  if (selectedDate.isBefore(minimumDate)) {
    return res.json(
      new ApiResponse(
        200,
        [],
        `Slots available after ${consultation.responseDays} days only`,
      ),
    );
  }

  const availability = await Availability.findOne();

  if (!availability) {
    throw new ApiError(404, "Availability not found");
  }

  const formattedDate = selectedDate.format("DD-MM-YYYY");

  console.log("Formatted Date:", formattedDate);

  const schedule = await Schedule.findOne({
    date: formattedDate,
  });

  console.log("Schedule:", schedule);

  if (schedule?.isBlocked) {
    return res.json(new ApiResponse(200, [], "This day is blocked"));
  }

  const normalize = (s) => s?.toString().trim().replace(/\s+/g, "");

  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const parseSlot = (s) => {
    const [a, b] = normalize(s).split("-");
    return { start: toMinutes(a), end: toMinutes(b) };
  };
  const overlaps = (slotA, slotB) => {
    const a = parseSlot(slotA);
    const b = parseSlot(slotB);
    return a.start < b.end && b.start < a.end;
  };

  const blockedSlotsList = (schedule?.blockedSlots || []).map(normalize);

  const bookedDocs = await Booking.find({
    date: formattedDate,
    status: "booked",
    isDeleted: false,
  }).select("slot");
  const bookedSlotsList = bookedDocs.map((b) => normalize(b.slot));

  // Use the consultation's own duration, not the global setting
  const slotDuration = consultation.duration;

  const slots = [];
  let current = dayjs(`${date} ${availability.startTime}`, "YYYY-MM-DD HH:mm");
  const end = dayjs(`${date} ${availability.endTime}`, "YYYY-MM-DD HH:mm");

  while (
    current.add(slotDuration, "minute").isBefore(end) ||
    current.add(slotDuration, "minute").isSame(end)
  ) {
    const slotEnd = current.add(slotDuration, "minute");
    const slotString = normalize(
      `${current.format("HH:mm")}-${slotEnd.format("HH:mm")}`,
    );

    const isBlocked = blockedSlotsList.some((b) => overlaps(slotString, b));
    const isBooked = bookedSlotsList.some((b) => overlaps(slotString, b));

    if (!isBlocked && !isBooked) {
      slots.push({
        startTime: current.format("HH:mm"),
        endTime: slotEnd.format("HH:mm"),
      });
    }

    current = slotEnd.add(availability.gap, "minute");
  }

  return res.json(new ApiResponse(200, slots, "Slots fetched"));
});

export const blockDate = asyncHandler(async (req, res) => {
  const { consultationId, date } = req.body;

  if (!consultationId || !date) {
    throw new ApiError(400, "consultationId and date required");
  }

  const consultation = await Consultation.findById(consultationId);

  if (!consultation) {
    throw new ApiError(404, "Consultation not found");
  }

  if (!consultation.unavailableDates.includes(date)) {
    consultation.unavailableDates.push(date);
  }

  await consultation.save();

  return res.json(new ApiResponse(200, consultation, "Date blocked"));
});
