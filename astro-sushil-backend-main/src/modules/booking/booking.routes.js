import express from "express";

import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";
import { authorize } from "../../middlewares/authorize.js";
import {
  createAdminBooking,
  createUserBooking,
  deleteBooking,
  downloadBookingInvoice,
  getAllBookings,
  getBookingById,
  getBookingsByDate,
  getMyBookings,
  rescheduleBooking,
  updateBookingPlan,
  verifyConsultationPayment,
} from "./booking.controller.js";
import { verifyToken } from "../../middlewares/verifyToken.js";

const router = express.Router();

router.post("/admin/book", adminVerifyJWT, authorize("bookings.create"), createAdminBooking);
router.patch("/reschedule/:bookingId", adminVerifyJWT, authorize("bookings.edit"), rescheduleBooking);
router.patch(
  "/bookings/:bookingId/change-plan",
  adminVerifyJWT,
  authorize("bookings.edit"),
  updateBookingPlan,
);
router.post("/book", verifyToken, createUserBooking);
router.post("/verify-payment", verifyToken, verifyConsultationPayment);
router.get("/my-bookings", verifyToken, getMyBookings);
router.get("/bookings", adminVerifyJWT, authorize("bookings.view"), getAllBookings);
router.get("/bookings/date", adminVerifyJWT, authorize("bookings.view"), getBookingsByDate);
router.get("/bookings/:id", adminVerifyJWT, authorize("bookings.view"), getBookingById);
router.delete("/bookings/:id", adminVerifyJWT, authorize("bookings.delete"), deleteBooking);
router.get(
  "/my-bookings/:bookingId/invoice",
  verifyToken,
  downloadBookingInvoice,
);

export default router;
