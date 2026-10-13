import { Contact } from "./contact.model.js";
import { contactSchemaZod, contactRemarksSchemaZod } from "./contact.validation.js";

import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import sendEmail from "../../service/sendEmail.js";

export const submitContact = asyncHandler(async (req, res) => {
  const result = contactSchemaZod.safeParse(req.body);

  if (!result.success) {
    console.log(result.error.issues);

    const errors = result.error.issues.map((e) => e.message);

    throw new ApiError(400, errors.join(", "));
  }

  const { name, email = "", phone, subject, message } = result.data;

  // ✅ Save in DB
  const contact = await Contact.create({
    name,
    email,
    phone,
    subject,
    message,
  });

  if (email.trim()) {
    // ✅ Email to Admin (Template use)
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      template: "CONTACT_ADMIN",
      data: { name, email, phone, subject, message },
    });

    // ✅ Email to User (Template use)
    await sendEmail({
      to: email,
      template: "CONTACT_USER",
      data: { name, message },
    });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, contact, "Contact submitted successfully"));
});

export const getContacts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = "", fromDate, toDate } = req.query;

  const query = {
    $or: [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { message: { $regex: search, $options: "i" } },
    ],
  };

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  const contacts = await Contact.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Contact.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(200, {
      contacts,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    }),
  );
});

export const getContactById = asyncHandler(async (req, res) => {
  const contact = await Contact.findById(req.params.id);

  if (!contact) {
    throw new ApiError(404, "Contact not found");
  }

  return res.status(200).json(new ApiResponse(200, contact));
});

export const updateContactRemarks = asyncHandler(async (req, res) => {
  const result = contactRemarksSchemaZod.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((e) => e.message);
    throw new ApiError(400, errors.join(", "));
  }

  const contact = await Contact.findByIdAndUpdate(
    req.params.id,
    { remarks: result.data.remarks },
    { new: true },
  );

  if (!contact) {
    throw new ApiError(404, "Contact not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, contact, "Remarks updated successfully"));
});

export const deleteContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findByIdAndDelete(req.params.id);

  if (!contact) {
    throw new ApiError(404, "Contact not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Contact deleted successfully"));
});
