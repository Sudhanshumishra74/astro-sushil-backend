import crypto from "crypto";
import mongoose from "mongoose";
import puppeteer from "puppeteer";

import Address from "../Address/address.model.js";
import Cart from "../cart/cart.modal.js";
import { Order } from "./order.model.js";
import { Product } from "../products/product.modal.js";
import { Transaction } from "../Transaction/Transaction.model.js";

import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { notificationQueue } from "../../queues/notification.queue.js";
import { createOrderSchema, verifyPaymentSchema } from "./order.validation.js";
import { getRateFor } from "../../utils/exchangeRate.js";
import { generateInvoiceTemplate } from "../../utils/invoice.template.js";
import { createDownloadsFromOrder } from "../Download/download.controller.js";
import { calculateCart } from "../../common/priceengine.js";
import { Coupon } from "../coupon/coupon.model.js";
import { User } from "../auth/user.modal.js";
import { createRazorpayOrder } from "../../utils/razorpay.js";
import { claimOrderPaymentWithInvoice } from "../../service/orderPaymentService.js";
import { findInvoiceForPdf } from "../../service/invoicePdfService.js";

export const reduceStock = async (order, session = null) => {
  for (const item of order.items) {
    const query = Product.findById(item.product);

    if (session) {
      query.session(session);
    }

    const product = await query;

    if (!product || product.type !== "physical") {
      continue;
    }

    if (product.hasVariants && item.variantId) {
      const variant = product.variants.id(item.variantId);

      if (!variant) {
        continue;
      }

      if (variant.stock < item.quantity) {
        throw new ApiError(400, `${product.name} variant out of stock`);
      }

      variant.stock = Math.max(0, variant.stock - item.quantity);

      product.markModified("variants");
    } else {
      if (product.stock < item.quantity) {
        throw new ApiError(400, `${product.name} out of stock`);
      }

      product.stock = Math.max(0, product.stock - item.quantity);
    }

    await product.save(session ? { session } : {});
  }
};

export const createOrder = asyncHandler(async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid input");
  }

  const { addressId, paymentMethod, currency = "INR" } = parsed.data;

  console.log("Parsed Data: ", parsed.data);

  const session = await mongoose.startSession();

  session.startTransaction();

  try {
    const cart = await Cart.findOne({
      user: req.user._id,
    }).session(session);

    if (!cart || !cart.items.length) {
      throw new ApiError(400, "Cart is empty");
    }

    await calculateCart(cart, req.user._id);

    const subTotal = cart.subTotal || 0;
    const discount = cart.discount || 0;
    const shipping = cart.shipping || 0;
    const tax = cart.tax || 0;
    const totalAmount = cart.totalAmount || 0;

    const selectedCurrency = currency.toUpperCase();

    const supportedCurrencies = [
      "INR",
      "USD",
      "EUR",
      "GBP",
      "AED",
      "AUD",
      "CAD",
      "SGD",
      "JPY",
    ];

    if (!supportedCurrencies.includes(selectedCurrency)) {
      throw new ApiError(400, "Unsupported currency");
    }

    const safeRate = Number(await getRateFor(selectedCurrency)) || 1;

    const convertedSubTotal = Number((subTotal * safeRate).toFixed(2));

    const convertedShipping = Number((shipping * safeRate).toFixed(2));

    const convertedTax = Number((tax * safeRate).toFixed(2));

    const convertedDiscount = Number((discount * safeRate).toFixed(2));

    const convertedAmount = Number((totalAmount * safeRate).toFixed(2));

    if (!convertedAmount) {
      throw new ApiError(400, "Currency amount not found");
    }

    let hasPhysicalProduct = false;

    const formattedItems = [];

    for (const item of cart.items) {
      const product = await Product.findById(item.product).session(session);

      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      let price = product.price;

      let mrp = product.mrp;

      let stock = product.stock;

      let image = product.thumbnail || product.images?.[0];

      if (product.hasVariants && item.variantId) {
        const variant = product.variants.id(item.variantId);

        if (!variant) {
          throw new ApiError(404, "Variant not found");
        }

        price = variant.price;
        mrp = variant.mrp;
        stock = variant.stock;
      }

      if (product.type === "physical") {
        hasPhysicalProduct = true;

        if (stock < item.quantity) {
          throw new ApiError(400, `${product.name} out of stock`);
        }
      }

      formattedItems.push({
        product: product._id,
        variantId: item.variantId || null,
        name: product.name,
        price,
        mrp,
        quantity: item.quantity,
        image,
        taxRate: item.taxRate || 0,
        taxType: item.taxType || "exclusive",
        taxAmount: Number(((item.taxAmount || 0) * safeRate).toFixed(2)),
      });
    }

    let addressDoc = null;

    let shippingAddress = null;

    if (hasPhysicalProduct && addressId) {
      addressDoc = await Address.findOne({
        _id: addressId,
        user: req.user._id,
      }).session(session);

      if (!addressDoc) {
        throw new ApiError(404, "Address not found");
      }

      shippingAddress = {
        fullName: addressDoc.fullName,
        phone: addressDoc.phone,
        pincode: addressDoc.pincode,
        state: addressDoc.state,
        city: addressDoc.city,
        addressLine1: addressDoc.addressLine1,
        addressLine2: addressDoc.addressLine2,
        landmark: addressDoc.landmark,
      };
    }

    const order = await Order.create(
      [
        {
          user: req.user._id,

          items: formattedItems,

          orderType: hasPhysicalProduct ? "physical" : "digital",

          addressId: addressDoc?._id || null,

          shippingAddress,

          subTotal: convertedSubTotal,

          discount: convertedDiscount,

          shipping: convertedShipping,

          tax: convertedTax,

          totalAmount: convertedAmount,

          baseAmount: totalAmount,

          baseCurrency: "INR",

          exchangeRate: safeRate,

          coupon: cart.appliedCoupon
            ? {
                code: cart.appliedCoupon,
                discountAmount: convertedDiscount,
              }
            : null,

          payment: {
            method: paymentMethod,
            currency: selectedCurrency,
            status: paymentMethod === "cod" ? "paid" : "pending",
          },

          orderStatus:
            paymentMethod === "cod" ? "confirmed" : "payment_pending",
        },
      ],
      { session },
    );

    await Transaction.create(
      [
        {
          user: req.user._id,

          order: order[0]._id,

          amount: convertedAmount,

          transactionType: "order",

          currency: selectedCurrency,

          baseCurrency: "INR",

          baseAmount: totalAmount,

          subTotal: convertedSubTotal,

          shipping: convertedShipping,

          tax: convertedTax,

          taxInclusive: false,

          discount: convertedDiscount,

          exchangeRate: safeRate,

          method: paymentMethod,

          status: paymentMethod === "cod" ? "success" : "pending",
        },
      ],
      { session },
    );

    let razorpayConfig = null;

    if (paymentMethod === "razorpay") {
      const rzpOrder = await createRazorpayOrder({
        amount: convertedAmount,
        currency: selectedCurrency,
        receipt: order[0]._id.toString(),
      });

      order[0].payment.razorpayOrderId = rzpOrder.id;

      await order[0].save({
        session,
      });

      await Transaction.findOneAndUpdate(
        {
          order: order[0]._id,
        },
        {
          $set: {
            razorpayOrderId: rzpOrder.id,
          },
        },
        { session },
      );

      razorpayConfig = {
        key: process.env.RAZORPAY_KEY_ID,
        orderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
      };
    }

    if (paymentMethod === "cod") {
      await reduceStock(order[0], session);

      if (order[0].coupon?.code) {
        await Coupon.findOneAndUpdate(
          {
            code: order[0].coupon.code,
          },
          {
            $inc: {
              usedCount: 1,
            },

            $push: {
              usedBy: {
                user: req.user._id,
                usedAt: new Date(),
              },
            },
          },
          { session },
        );
      }

      cart.items = [];
      cart.subTotal = 0;
      cart.discount = 0;
      cart.shipping = 0;
      cart.tax = 0;
      cart.totalAmount = 0;
      cart.couponCode = null;
      cart.appliedCoupon = null;

      await cart.save({
        session,
      });
    }

    await session.commitTransaction();

    session.endSession();

    return res.json(
      new ApiResponse(
        200,
        {
          order: order[0],
          paymentRequired: paymentMethod === "razorpay",
          razorpayConfig,
        },
        "Order created successfully",
      ),
    );
  } catch (err) {
    await session.abortTransaction();

    session.endSession();

    throw err;
  }
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const parsed = verifyPaymentSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid input");
  }

  const {
    orderId,
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
  } = parsed.data;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid order id");
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw new ApiError(400, "Invalid payment signature");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  let sessionEnded = false;
  const endSessionOnce = async () => {
    if (!sessionEnded) {
      sessionEnded = true;
      await session.endSession();
    }
  };

  let claimResult;

  try {
    claimResult = await claimOrderPaymentWithInvoice({
      orderId,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      session,
    });

    await session.commitTransaction();
    await endSessionOnce();
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (abortError) {
      console.error(
        { orderId, err: abortError },
        "verifyPayment: transaction abort failed",
      );
    } finally {
      try {
        await endSessionOnce();
      } catch (endError) {
        console.error(
          { orderId, err: endError },
          "verifyPayment: session cleanup failed",
        );
      }
    }
    throw err;
  }

  if (!claimResult.claimed) {
    // Webhook already processed this payment — return success without re-running side effects
    console.info(
      { orderId },
      "verifyPayment: webhook already claimed, skipping post-processing",
    );
    const alreadyPaid = await Order.findById(orderId).lean();
    return res.json(
      new ApiResponse(200, alreadyPaid, "Payment already verified"),
    );
  }

  const claimedOrder = claimResult.order;

  // Post-commit side effects — best effort, each isolated so one failure doesn't block others
  try {
    await reduceStock(claimedOrder);
  } catch (err) {
    console.error({ orderId, err }, "verifyPayment: stock reduction failed");
  }

  if (claimedOrder.coupon?.code) {
    try {
      await Coupon.findOneAndUpdate(
        { code: claimedOrder.coupon.code },
        {
          $inc: { usedCount: 1 },
          $push: { usedBy: { user: claimedOrder.user, usedAt: new Date() } },
        },
      );
    } catch (err) {
      console.error({ orderId, err }, "verifyPayment: coupon update failed");
    }
  }

  try {
    await Cart.findOneAndUpdate(
      { user: claimedOrder.user },
      {
        $set: {
          items: [],
          subTotal: 0,
          discount: 0,
          shipping: 0,
          tax: 0,
          totalAmount: 0,
          couponCode: null,
          appliedCoupon: null,
        },
      },
    );
  } catch (err) {
    console.error({ orderId, err }, "verifyPayment: cart clearing failed");
  }

  try {
    await createDownloadsFromOrder(claimedOrder._id);

    if (claimedOrder.orderType === "digital") {
      await Order.findByIdAndUpdate(claimedOrder._id, {
        $set: { orderStatus: "delivered" },
      });
      claimedOrder.orderStatus = "delivered";
    }
  } catch (err) {
    console.error({ orderId, err }, "verifyPayment: download creation failed");
  }

  try {
    const user = await User.findById(claimedOrder.user)
      .select("firstName email phoneNumber")
      .lean();

    await notificationQueue.add("order-confirmed", {
      orderId: claimedOrder._id.toString(),
      orderStatus: claimedOrder.orderStatus,
      userEmail: user?.email,
      userName: user?.firstName,
      userPhone: user?.phoneNumber,
      subTotal: claimedOrder.subTotal,
      totalAmount: claimedOrder.totalAmount,
      shipping: claimedOrder.shipping,
      currency: claimedOrder.payment?.currency || "INR",
      orderType: claimedOrder.orderType,
      products: claimedOrder.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
    });
  } catch (err) {
    console.error({ orderId, err }, "verifyPayment: notification failed");
  }

  return res.json(
    new ApiResponse(200, claimedOrder, "Payment verified successfully"),
  );
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({
    user: req.user._id,
  }).sort({ createdAt: -1 });

  return res.json(new ApiResponse(200, orders, "Orders fetched successfully"));
});

export const getOrderDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid order id");
  }

  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id,
  }).populate("items.product");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  return res.json(new ApiResponse(200, order, "Order fetched successfully"));
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id,
  });

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.orderStatus === "delivered") {
    throw new ApiError(400, "Delivered order cannot be cancelled");
  }

  order.orderStatus = "cancelled";

  await order.save();

  return res.json(new ApiResponse(200, order, "Order cancelled successfully"));
});

export const downloadInvoice = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id,
    });

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    if (order.payment?.status !== "paid") {
      throw new ApiError(409, "Order payment is not successful");
    }

    const transactions = await Transaction.find({
      order: order._id,
      transactionType: "order",
      status: "success",
    }).lean();
    if (transactions.length !== 1) {
      throw new ApiError(
        409,
        transactions.length > 1
          ? "Order has ambiguous successful transactions"
          : "Successful Order transaction not found",
      );
    }

    const transaction = transactions[0];
    if (
      order.payment?.method === "razorpay" &&
      order.payment.razorpayOrderId !== transaction.razorpayOrderId
    ) {
      throw new ApiError(409, "Order payment transaction is inconsistent");
    }

    const invoice = await findInvoiceForPdf({
      sourceType: "order",
      sourceId: order._id,
      transactionId: transaction?._id,
    });
    const html = generateInvoiceTemplate(order, invoice?.invoiceNumber);

    const browser = await puppeteer.connect({
      browserWSEndpoint: process.env.PDF_SERVER,
    });

    let pdfBuffer;

    try {
      const page = await browser.newPage();

      await page.setContent(html, { waitUntil: "networkidle0" });

      pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
      });
    } finally {
      await browser.close();
    }

    if (!pdfBuffer || pdfBuffer.length < 1000) {
      throw new Error("PDF generation failed");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${orderId}.pdf`,
    );

    return res.end(pdfBuffer);
  } catch (error) {
    throw error;
  }
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = req.query.search || "";
  const status = req.query.status || "";
  const { fromDate, toDate, productId } = req.query;

  const skip = (page - 1) * limit;

  const query = {};

  if (status) {
    query.orderStatus = status;
  }

  if (productId) {
    query["items.product"] = productId;
  }

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  if (search) {
    const matchedUsers = await User.find({
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ],
    }).select("_id");

    query.$or = [
      { user: { $in: matchedUsers.map((u) => u._id) } },
      { "shippingAddress.phone": { $regex: search, $options: "i" } },
      { "items.name": { $regex: search, $options: "i" } },
    ];
  }

  const totalOrders = await Order.countDocuments(query);

  const orders = await Order.find(query)
    .populate("user", "firstName lastName email phoneNumber")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return res.json(
    new ApiResponse(
      200,
      {
        orders,
        pagination: {
          totalOrders,
          currentPage: page,
          totalPages: Math.ceil(totalOrders / limit),
          limit,
        },
      },
      "All orders fetched successfully",
    ),
  );
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { orderStatus } = req.body;

  const allowedStatus = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];

  if (!allowedStatus.includes(orderStatus)) {
    throw new ApiError(400, "Invalid order status");
  }

  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  order.orderStatus = orderStatus;

  await order.save();

  try {
    const user = await User.findById(order.user)
      .select("firstName email phoneNumber")
      .lean();

    await notificationQueue.add("order-confirmed", {
      orderId: order._id.toString(),
      orderStatus: order.orderStatus,
      userEmail: user?.email,
      userName: user?.firstName,
      userPhone: user?.phoneNumber,
      subTotal: order.subTotal,
      totalAmount: order.totalAmount,
      shipping: order.shipping,
      currency: order.payment?.currency || "INR",
      orderType: order.orderType,
      products: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
    });
  } catch (err) {
    console.error({ orderId, err }, "verifyPayment: notification failed");
  }

  return res.json(
    new ApiResponse(200, order, "Order status updated successfully"),
  );
});

export const getAdminOrderDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId)
    .populate("user", "name email phone")
    .populate("items.product", "name price images");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  return res.json(
    new ApiResponse(200, order, "Order details fetched successfully"),
  );
});

export const getOrderReports = asyncHandler(async (req, res) => {
  const totalOrders = await Order.countDocuments();

  const totalSalesData = await Order.aggregate([
    { $match: { "payment.status": "paid" } },
    { $group: { _id: null, totalSales: { $sum: "$totalAmount" } } },
  ]);

  const statusWiseOrders = await Order.aggregate([
    { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
  ]);

  const paymentMethodBreakdown = await Order.aggregate([
    { $group: { _id: "$payment.method", count: { $sum: 1 } } },
  ]);

  const paymentStatusBreakdown = await Order.aggregate([
    { $group: { _id: "$payment.status", count: { $sum: 1 } } },
  ]);

  const orderTypeBreakdown = await Order.aggregate([
    { $group: { _id: "$orderType", count: { $sum: 1 } } },
  ]);

  const avgOrderValue = await Order.aggregate([
    { $match: { "payment.status": "paid" } },
    { $group: { _id: null, avg: { $avg: "$totalAmount" } } },
  ]);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const dailyRevenue = await Order.aggregate([
    {
      $match: {
        "payment.status": "paid",
        createdAt: { $gte: sevenDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        revenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const monthlyRevenue = await Order.aggregate([
    {
      $match: {
        "payment.status": "paid",
        createdAt: { $gte: sixMonthsAgo },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$createdAt" },
        },
        revenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // 10. Recent orders (last 5)
  const recentOrders = await Order.find()
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .limit(5);

  return res.json(
    new ApiResponse(
      200,
      {
        totalOrders,
        totalSales: totalSalesData[0]?.totalSales || 0,
        avgOrderValue: Math.round(avgOrderValue[0]?.avg || 0),
        statusWiseOrders,
        paymentMethodBreakdown,
        paymentStatusBreakdown,
        orderTypeBreakdown,
        dailyRevenue,
        monthlyRevenue,
        recentOrders,
      },
      "Order reports fetched successfully",
    ),
  );
});
