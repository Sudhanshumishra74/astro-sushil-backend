import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { settingSchemaZod } from "./setting.validation.js";
import Setting from "./Setting.model.js";
import merge from "lodash/merge.js";

import mongoose from "mongoose";
import { Order } from "../Order/order.model.js";
import { Booking } from "../booking/booking.model.js";
import { Transaction } from "../Transaction/Transaction.model.js";
import ReportOrder from "../Reports/reportOrder.model.js";
import { User } from "../auth/user.modal.js";
import { nowIST, IST } from "../../utils/time.js";

export const getSettings = asyncHandler(async (req, res) => {
  let settings = await Setting.findOne();

  if (!settings) {
    settings = await Setting.create({});
  }

  return res
    .status(200)
    .json(new ApiResponse(200, settings, "Settings fetched successfully"));
});

export const updateSettings = asyncHandler(async (req, res) => {
  const parsed = settingSchemaZod.safeParse(req.body);

  if (!parsed.success) {
    const message = parsed.error?.issues?.[0]?.message || "Validation failed";
    throw new ApiError(400, message);
  }

  let settings = await Setting.findOne();

  if (!settings) {
    settings = new Setting({});
  }

  const updateData = parsed.data;
  const merged = merge({}, settings.toObject(), updateData, {
    updatedBy: req.admin?._id,
  });

  settings = await Setting.findByIdAndUpdate(settings._id, merged, {
    new: true,
    runValidators: true,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, settings, "Settings updated successfully"));
});

export const getDashboardData = async (req, res) => {
  try {
    const nowIst = nowIST();
    const currentYear = nowIst.year();
    const startOfYear = nowIst.startOf("year").toDate();
    const startOfMonth = nowIst.startOf("month").toDate();
    const lastMonthStart = nowIst.subtract(1, "month").startOf("month").toDate();
    const lastMonthEnd = nowIst.subtract(1, "month").endOf("month").toDate();

    const BOOKING_AMOUNT = { $cond: [{ $gt: ["$baseAmount", 0] }, "$baseAmount", "$amount"] };
    const REPORT_AMOUNT = { $cond: [{ $gt: ["$baseAmount", 0] }, "$baseAmount", "$amount"] };

    const [
      // All-time total revenue (3 sources)
      bookingRevTotal,
      orderRevTotal,
      reportRevTotal,
      // This month revenue (3 sources)
      bookingRevMonth,
      orderRevMonth,
      reportRevMonth,
      // Last month revenue (3 sources)
      bookingRevLastMonth,
      orderRevLastMonth,
      reportRevLastMonth,
      // Orders: this month, last month, all-time
      ordersThisMonth,
      ordersLastMonth,
      totalOrders,
      // Bookings: this month, last month, all-time
      bookingsThisMonth,
      bookingsLastMonth,
      totalBookings,
      // Report orders: this month, last month, all-time
      reportOrdersThisMonth,
      reportOrdersLastMonth,
      totalReportOrders,
      // Users: new this month, last month
      newUsers,
      lastMonthUsers,
      // Monthly revenue for current year (chart)
      bookingMonthlyYear,
      orderMonthlyYear,
      reportMonthlyYear,
      // Monthly counts for current year (chart month selection)
      ordersMonthlyYear,
      bookingsMonthlyYear,
      reportOrdersMonthlyYear,
      // Yearly revenue totals (chart)
      bookingYearly,
      orderYearly,
      reportYearly,
      // Top products
      topProducts,
    ] = await Promise.all([
      // ── All-time revenue ──
      Booking.aggregate([
        { $match: { status: "booked", paymentStatus: "paid", isDeleted: false } },
        { $group: { _id: null, total: { $sum: BOOKING_AMOUNT } } },
      ]),
      Order.aggregate([
        { $match: { "payment.status": "paid" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      ReportOrder.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: REPORT_AMOUNT } } },
      ]),

      // ── This month revenue ──
      Booking.aggregate([
        { $match: { status: "booked", paymentStatus: "paid", isDeleted: false, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: BOOKING_AMOUNT } } },
      ]),
      Order.aggregate([
        { $match: { "payment.status": "paid", createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      ReportOrder.aggregate([
        { $match: { paymentStatus: "paid", createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: REPORT_AMOUNT } } },
      ]),

      // ── Last month revenue ──
      Booking.aggregate([
        { $match: { status: "booked", paymentStatus: "paid", isDeleted: false, createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $group: { _id: null, total: { $sum: BOOKING_AMOUNT } } },
      ]),
      Order.aggregate([
        { $match: { "payment.status": "paid", createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      ReportOrder.aggregate([
        { $match: { paymentStatus: "paid", createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $group: { _id: null, total: { $sum: REPORT_AMOUNT } } },
      ]),

      // ── Orders counts ──
      Order.countDocuments({
        createdAt: { $gte: startOfMonth },
        orderStatus: { $nin: ["payment_pending", "payment_failed", "cancelled"] },
        "payment.status": "paid",
      }),
      Order.countDocuments({
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
        orderStatus: { $nin: ["payment_pending", "payment_failed", "cancelled"] },
        "payment.status": "paid",
      }),
      Order.countDocuments({
        orderStatus: { $nin: ["payment_pending", "payment_failed", "cancelled"] },
        "payment.status": "paid",
      }),

      // ── Bookings counts ──
      Booking.countDocuments({
        createdAt: { $gte: startOfMonth },
        status: "booked",
        paymentStatus: "paid",
        isDeleted: false,
      }),
      Booking.countDocuments({
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
        status: "booked",
        paymentStatus: "paid",
        isDeleted: false,
      }),
      Booking.countDocuments({
        status: "booked",
        paymentStatus: "paid",
        isDeleted: false,
      }),

      // ── Report orders counts ──
      ReportOrder.countDocuments({
        paymentStatus: "paid",
        createdAt: { $gte: startOfMonth },
      }),
      ReportOrder.countDocuments({
        paymentStatus: "paid",
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
      }),
      ReportOrder.countDocuments({ paymentStatus: "paid" }),

      // ── Users ──
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),

      // ── Monthly revenue for current year (for chart) ──
      Booking.aggregate([
        { $match: { status: "booked", paymentStatus: "paid", isDeleted: false, createdAt: { $gte: startOfYear } } },
        { $group: { _id: { $month: { date: "$createdAt", timezone: IST } }, revenue: { $sum: BOOKING_AMOUNT } } },
      ]),
      Order.aggregate([
        { $match: { "payment.status": "paid", createdAt: { $gte: startOfYear } } },
        { $group: { _id: { $month: { date: "$createdAt", timezone: IST } }, revenue: { $sum: "$totalAmount" } } },
      ]),
      ReportOrder.aggregate([
        { $match: { paymentStatus: "paid", createdAt: { $gte: startOfYear } } },
        { $group: { _id: { $month: { date: "$createdAt", timezone: IST } }, revenue: { $sum: REPORT_AMOUNT } } },
      ]),

      // ── Monthly counts for current year (for chart month selection) ──
      Order.aggregate([
        {
          $match: {
            "payment.status": "paid",
            orderStatus: { $nin: ["payment_pending", "payment_failed", "cancelled"] },
            createdAt: { $gte: startOfYear },
          },
        },
        { $group: { _id: { $month: { date: "$createdAt", timezone: IST } }, count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $match: { status: "booked", paymentStatus: "paid", isDeleted: false, createdAt: { $gte: startOfYear } } },
        { $group: { _id: { $month: { date: "$createdAt", timezone: IST } }, count: { $sum: 1 } } },
      ]),
      ReportOrder.aggregate([
        { $match: { paymentStatus: "paid", createdAt: { $gte: startOfYear } } },
        { $group: { _id: { $month: { date: "$createdAt", timezone: IST } }, count: { $sum: 1 } } },
      ]),

      // ── Yearly revenue totals (for chart) ──
      Booking.aggregate([
        { $match: { status: "booked", paymentStatus: "paid", isDeleted: false } },
        { $group: { _id: { $year: { date: "$createdAt", timezone: IST } }, revenue: { $sum: BOOKING_AMOUNT } } },
      ]),
      Order.aggregate([
        { $match: { "payment.status": "paid" } },
        { $group: { _id: { $year: { date: "$createdAt", timezone: IST } }, revenue: { $sum: "$totalAmount" } } },
      ]),
      ReportOrder.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: { $year: { date: "$createdAt", timezone: IST } }, revenue: { $sum: REPORT_AMOUNT } } },
      ]),

      // ── Top products ──
      Order.aggregate([
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            name: { $first: "$items.name" },
            totalSold: { $sum: "$items.quantity" },
            revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 5 },
      ]),
    ]);

    // ── Computed values ──
    const totalRevenue =
      (bookingRevTotal[0]?.total || 0) +
      (orderRevTotal[0]?.total || 0) +
      (reportRevTotal[0]?.total || 0);

    const revenueThisMonth =
      (bookingRevMonth[0]?.total || 0) +
      (orderRevMonth[0]?.total || 0) +
      (reportRevMonth[0]?.total || 0);

    const revenueLastMonth =
      (bookingRevLastMonth[0]?.total || 0) +
      (orderRevLastMonth[0]?.total || 0) +
      (reportRevLastMonth[0]?.total || 0);

    const revenueGrowth = revenueLastMonth
      ? (((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100).toFixed(1)
      : 0;

    const orderGrowth = ordersLastMonth
      ? (((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100).toFixed(1)
      : 0;

    const bookingGrowth = bookingsLastMonth
      ? (((bookingsThisMonth - bookingsLastMonth) / bookingsLastMonth) * 100).toFixed(1)
      : 0;

    const reportOrderGrowth = reportOrdersLastMonth
      ? (((reportOrdersThisMonth - reportOrdersLastMonth) / reportOrdersLastMonth) * 100).toFixed(1)
      : 0;

    const userGrowth = lastMonthUsers
      ? (((newUsers - lastMonthUsers) / lastMonthUsers) * 100).toFixed(1)
      : 0;

    // Build monthly revenue: 12 months for the current year, all zeros filled
    const monthMap = {};
    for (const e of [...bookingMonthlyYear, ...orderMonthlyYear, ...reportMonthlyYear]) {
      monthMap[e._id] = (monthMap[e._id] || 0) + e.revenue;
    }
    const monthlyRevenue = Array.from({ length: 12 }, (_, i) => ({
      _id: i + 1,
      revenue: monthMap[i + 1] || 0,
    }));

    // Build monthly counts: 12 months for the current year, all zeros filled
    const toCountArray = (rows) => {
      const map = {};
      for (const e of rows) map[e._id] = e.count;
      return Array.from({ length: 12 }, (_, i) => ({
        _id: i + 1,
        count: map[i + 1] || 0,
      }));
    };
    const monthlyOrders = toCountArray(ordersMonthlyYear);
    const monthlyBookings = toCountArray(bookingsMonthlyYear);
    const monthlyReportOrders = toCountArray(reportOrdersMonthlyYear);

    // Build yearly revenue: sum per year
    const yearMap = {};
    for (const e of [...bookingYearly, ...orderYearly, ...reportYearly]) {
      yearMap[e._id] = (yearMap[e._id] || 0) + e.revenue;
    }
    const yearlyRevenue = Object.entries(yearMap)
      .map(([year, revenue]) => ({ year: Number(year), revenue }))
      .sort((a, b) => a.year - b.year);

    res.json({
      success: true,
      data: {
        totalRevenue,
        revenueThisMonth,
        revenueGrowth: Number(revenueGrowth),
        orders: {
          count: ordersThisMonth,
          total: totalOrders,
          growth: Number(orderGrowth),
        },
        bookings: {
          count: bookingsThisMonth,
          total: totalBookings,
          growth: Number(bookingGrowth),
        },
        reportOrders: {
          count: reportOrdersThisMonth,
          total: totalReportOrders,
          growth: Number(reportOrderGrowth),
        },
        users: {
          count: newUsers,
          growth: Number(userGrowth),
        },
        monthlyRevenue,
        monthlyOrders,
        monthlyBookings,
        monthlyReportOrders,
        yearlyRevenue,
        topProducts,
      },
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard",
    });
  }
};
