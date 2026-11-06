import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { Shipment } from "./shipment.model.js";
import {
  retryShipment,
  generateLabel,
} from "../Fulfillment/fulfillment.service.js";
import { logActivity } from "../AuditLog/auditLog.service.js";

/**
 * Flat, paginated view of every shipment across every order — now a plain
 * query against the Shipment collection (was a $unwind aggregation over
 * every Order). Response shape ({orderId, customer, shippingAddress,
 * shipment}) is preserved from its earlier {orderId, userName, userEmail,
 * shipment} form, just with richer customer/address fields.
 */
export const getAllShipments = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Number(req.query.limit) || 10);
  const { status } = req.query;

  const filter = {};
  if (status) filter.status = status;

  const [shipments, total] = await Promise.all([
    Shipment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: "order",
        select: "user shippingAddress",
        populate: { path: "user", select: "firstName email phoneNumber" },
      })
      .lean(),
    Shipment.countDocuments(filter),
  ]);

  const data = shipments.map(({ order, ...shipment }) => ({
    orderId: order?._id,
    customer: {
      name: order?.shippingAddress?.fullName || order?.user?.firstName || null,
      email: order?.user?.email || null,
      phone: order?.shippingAddress?.phone || order?.user?.phoneNumber || null,
    },
    shippingAddress: order?.shippingAddress || null,
    shipment,
  }));

  res.json(new ApiResponse(200, data, "Shipments fetched", { total, page, limit }));
});

export const getOrderShipments = asyncHandler(async (req, res) => {
  const shipments = await Shipment.find({ order: req.params.orderId }).sort({ createdAt: -1 }).lean();
  res.json(new ApiResponse(200, shipments, "Shipments fetched"));
});

export const getShipmentById = asyncHandler(async (req, res) => {
  const shipment = await Shipment.findById(req.params.shipmentId).lean();
  if (!shipment) throw new ApiError(404, "Shipment not found");

  res.json(new ApiResponse(200, shipment, "Shipment fetched"));
});

export const retryShipmentHandler = asyncHandler(async (req, res) => {
  const shipment = await retryShipment(req.params.shipmentId);

  await logActivity({
    admin: req.user,
    action: "shipment.retry",
    targetType: "Shipment",
    targetId: shipment._id,
    targetLabel: `#${String(shipment._id).slice(-8).toUpperCase()}`,
    changes: [],
  });

  res.json(new ApiResponse(200, shipment, "Shipment retried"));
});

export const generateLabelHandler = asyncHandler(async (req, res) => {
  const shipment = await generateLabel(req.params.shipmentId);

  await logActivity({
    admin: req.user,
    action: "shipment.generate_label",
    targetType: "Shipment",
    targetId: shipment._id,
    targetLabel: `#${String(shipment._id).slice(-8).toUpperCase()}`,
    changes: [],
  });

  res.json(new ApiResponse(200, shipment, "Label generated"));
});
