import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import mongoose from "mongoose";

const sourceId = new mongoose.Types.ObjectId();
const transactionId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
let orderTemplateArgs;
let bookingTemplateArgs;
let reportTemplateArgs;
let generatedPdfCount = 0;
let renderedHtml;

const makeResponse = () => ({
  headersSent: false,
  statusCode: null,
  body: null,
  headers: {},
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  setHeader(name, value) {
    this.headers[name] = value;
  },
  end(value) {
    this.body = value;
    return this;
  },
});

const makeLeanQuery = (value) => ({
  lean: async () => value,
});

const makePopulateQuery = (value) => {
  const query = {
    populate() {
      return query;
    },
    lean: async () => value,
  };
  return query;
};

const makeBrowser = () => ({
  async newPage() {
    return {
      async setContent(html) {
        renderedHtml = html;
      },
      async pdf() {
        generatedPdfCount += 1;
        return Buffer.alloc(1001);
      },
    };
  },
  async close() {},
});

const mockDependencies = () => {
  mock.module("../src/queues/notification.queue.js", {
    namedExports: { notificationQueue: { add: async () => {} } },
  });
  mock.module("../src/queues/process-report-pdf.queue.js", {
    namedExports: { processReportPDFQueue: { add: async () => {} } },
  });
  mock.module("../src/modules/Download/download.controller.js", {
    namedExports: { createDownloadsFromOrder: async () => {} },
  });
  mock.module("../src/modules/cart/cart.modal.js", {
    defaultExport: { findOneAndUpdate: async () => {} },
  });
  mock.module("../src/modules/coupon/coupon.model.js", {
    namedExports: { Coupon: { findOneAndUpdate: async () => {} } },
  });
  mock.module("../src/modules/auth/user.modal.js", {
    namedExports: {
      User: {
        findById: () => ({
          select: () => ({ lean: async () => ({}) }),
        }),
      },
    },
  });
  mock.module("../src/utils/exchangeRate.js", {
    namedExports: { getRateFor: async () => 1 },
  });
  mock.module("../src/utils/razorpay.js", {
    namedExports: { createRazorpayOrder: async () => ({}) },
  });
  mock.module("puppeteer", {
    defaultExport: { connect: async () => makeBrowser() },
  });
  mock.module("../src/utils/invoice.template.js", {
    namedExports: {
      generateInvoiceTemplate: (...args) => {
        orderTemplateArgs = args;
        return `order-pdf-${args[1] || ""}`;
      },
    },
  });
  mock.module("../src/utils/generateBookingInvoiceTemplate.js", {
    namedExports: {
      generateBookingInvoiceTemplate: (...args) => {
        bookingTemplateArgs = args;
        return `booking-pdf-${args[1] || ""}`;
      },
    },
  });
  mock.module("../src/utils/generateReportInvoiceTemplate.js", {
    namedExports: {
      generateReportInvoiceTemplate: (...args) => {
        reportTemplateArgs = args;
        return `report-pdf-${args[0]?.invoiceNumber || ""}`;
      },
    },
  });
};

let Order;
let Booking;
let ReportOrder;
let Transaction;
let Invoice;
let InvoiceCounter;
let orderController;
let bookingController;
let reportController;
let transactionController;
let original;

before(async () => {
  mockDependencies();
  ({ Order } = await import("../src/modules/Order/order.model.js"));
  ({ Booking } = await import("../src/modules/booking/booking.model.js"));
  ({ default: ReportOrder } = await import(
    "../src/modules/Reports/reportOrder.model.js"
  ));
  ({ Transaction } = await import(
    "../src/modules/Transaction/Transaction.model.js"
  ));
  ({ Invoice } = await import("../src/modules/Invoice/invoice.model.js"));
  ({ InvoiceCounter } = await import(
    "../src/modules/Invoice/invoiceCounter.model.js"
  ));
  original = {
    orderFindOne: Order.findOne,
    bookingFindOne: Booking.findOne,
    reportFindOne: ReportOrder.findOne,
    transactionFind: Transaction.find,
    invoiceFindOne: Invoice.findOne,
    invoiceCreate: Invoice.create,
    counterFindOneAndUpdate: InvoiceCounter.findOneAndUpdate,
  };
  orderController = await import(
    `../src/modules/Order/order.controller.js?pdf=${Date.now()}`
  );
  bookingController = await import(
    `../src/modules/booking/booking.controller.js?pdf=${Date.now()}`
  );
  reportController = await import(
    `../src/modules/Reports/report.controller.js?pdf=${Date.now()}`
  );
  transactionController = await import(
    `../src/modules/Transaction/Transaction.controler.js?pdf=${Date.now()}`
  );
});

after(() => {
  Order.findOne = original.orderFindOne;
  Booking.findOne = original.bookingFindOne;
  ReportOrder.findOne = original.reportFindOne;
  Transaction.find = original.transactionFind;
  Invoice.findOne = original.invoiceFindOne;
  Invoice.create = original.invoiceCreate;
  InvoiceCounter.findOneAndUpdate = original.counterFindOneAndUpdate;
  mock.restoreAll();
});

const resetTestObservations = () => {
  orderTemplateArgs = undefined;
  bookingTemplateArgs = undefined;
  reportTemplateArgs = undefined;
  generatedPdfCount = 0;
  renderedHtml = undefined;
  Invoice.create = async () => {
    throw new Error("Invoice creation must not occur during PDF generation");
  };
  InvoiceCounter.findOneAndUpdate = async () => {
    throw new Error("Invoice counter must not be used during PDF generation");
  };
};

describe("PDF controller payment validation", () => {
  it("preserves Order ownership and renders the persisted invoice number", async () => {
    resetTestObservations();
    let orderFilter;
    Order.findOne = (filter) => {
      orderFilter = filter;
      return {
        payment: { status: "paid", method: "razorpay", razorpayOrderId: "rzp-order" },
        _id: sourceId,
      };
    };
    Transaction.find = (filter) => {
      assert.deepEqual(filter, {
        order: sourceId,
        transactionType: "order",
        status: "success",
      });
      return makeLeanQuery([
        { _id: transactionId, razorpayOrderId: "rzp-order" },
      ]);
    };
    Invoice.findOne = () => makeLeanQuery({
      sourceType: "order",
      sourceId,
      transaction: transactionId,
      invoiceNumber: "INV-AS/42",
    });

    const response = makeResponse();
    await orderController.downloadInvoice(
      { params: { orderId: sourceId.toString() }, user: { _id: userId } },
      response,
      (error) => {
        throw error;
      },
    );

    assert.deepEqual(orderFilter, { _id: sourceId.toString(), user: userId });
    assert.equal(orderTemplateArgs[1], "INV-AS/42");
    assert.match(renderedHtml, /INV-AS\/42/);
    assert.equal(response.headers["Content-Type"], "application/pdf");
    assert.match(
      response.headers["Content-Disposition"],
      /invoice-.*\.pdf/,
    );
    assert.ok(response.body);
    assert.equal(response.body.length, 1001);
    assert.equal(generatedPdfCount, 1);
  });

  it("fails safely for an inconsistent Order Invoice without generating a PDF", async () => {
    resetTestObservations();
    Order.findOne = () => ({
      payment: { status: "paid", method: "cod" },
      _id: sourceId,
    });
    Transaction.find = () =>
      makeLeanQuery([{ _id: transactionId, status: "success" }]);
    Invoice.findOne = () =>
      makeLeanQuery({
        sourceType: "order",
        sourceId,
        transaction: new mongoose.Types.ObjectId(),
        invoiceNumber: "INV-AS/42",
      });

    const response = makeResponse();
    await orderController.downloadInvoice(
      { params: { orderId: sourceId.toString() }, user: { _id: userId } },
      response,
      () => {},
    );

    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /inconsistent/i);
    assert.equal(generatedPdfCount, 0);
  });

  it("fails safely for an Invoice with a mismatched source", async () => {
    resetTestObservations();
    Order.findOne = () => ({
      payment: { status: "paid", method: "cod" },
      _id: sourceId,
    });
    Transaction.find = () =>
      makeLeanQuery([{ _id: transactionId, status: "success" }]);
    Invoice.findOne = () =>
      makeLeanQuery({
        sourceType: "booking",
        sourceId,
        transaction: transactionId,
        invoiceNumber: "INV-AS/42",
      });

    const response = makeResponse();
    await orderController.downloadInvoice(
      { params: { orderId: sourceId.toString() }, user: { _id: userId } },
      response,
      () => {},
    );

    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /inconsistent/i);
    assert.equal(generatedPdfCount, 0);
  });

  it("fails safely for an ambiguous Order transaction", async () => {
    resetTestObservations();
    Order.findOne = () => ({
      payment: { status: "paid", method: "cod" },
      _id: sourceId,
    });
    Transaction.find = () =>
      makeLeanQuery([
        { _id: transactionId, status: "success" },
        { _id: new mongoose.Types.ObjectId(), status: "success" },
      ]);

    const response = makeResponse();
    await orderController.downloadInvoice(
      { params: { orderId: sourceId.toString() }, user: { _id: userId } },
      response,
      () => {},
    );

    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /ambiguous/i);
  });

  it("validates the authoritative Booking transaction and ownership", async () => {
    resetTestObservations();
    let bookingFilter;
    Booking.findOne = (filter) => {
      bookingFilter = filter;
      return makePopulateQuery({
        _id: sourceId,
        paymentStatus: "paid",
        transactionId: { _id: transactionId, status: "success" },
      });
    };
    Invoice.findOne = () =>
      makeLeanQuery({
        sourceType: "booking",
        sourceId,
        transaction: transactionId,
        invoiceNumber: "INV-AS/42",
      });

    const response = makeResponse();
    await bookingController.downloadBookingInvoice(
      { params: { bookingId: sourceId.toString() }, user: { _id: userId } },
      response,
      (error) => {
        throw error;
      },
    );

    assert.deepEqual(bookingFilter, {
      _id: sourceId.toString(),
      userId,
      isDeleted: false,
    });
    assert.ok(response.body);
    if (bookingTemplateArgs) {
      assert.equal(bookingTemplateArgs[1], "INV-AS/42");
    }
    assert.ok(response.body);
  });

  it("fails safely when Booking payment is not paid", async () => {
    resetTestObservations();
    Booking.findOne = () =>
      makePopulateQuery({
        _id: sourceId,
        paymentStatus: "pending",
        transactionId: { _id: transactionId, status: "success" },
      });

    const response = makeResponse();
    await bookingController.downloadBookingInvoice(
      { params: { bookingId: sourceId.toString() }, user: { _id: userId } },
      response,
      () => {},
    );

    assert.equal(response.statusCode, 409);
    assert.equal(generatedPdfCount, 0);
  });

  for (const [label, transactionIdValue] of [
    ["missing", null],
    ["unpopulated", transactionId],
    ["pending", { _id: transactionId, status: "pending" }],
    ["failed", { _id: transactionId, status: "failed" }],
  ]) {
    it(`fails safely for a ${label} Booking transaction`, async () => {
      resetTestObservations();
      Booking.findOne = () =>
        makePopulateQuery({
          _id: sourceId,
          paymentStatus: "paid",
          transactionId: transactionIdValue,
        });

      const response = makeResponse();
      await bookingController.downloadBookingInvoice(
        { params: { bookingId: sourceId.toString() }, user: { _id: userId } },
        response,
        () => {},
      );

      assert.equal(response.statusCode, 409);
      assert.equal(generatedPdfCount, 0);
    });
  }

  it("selects one successful Report transaction and preserves ownership", async () => {
    resetTestObservations();
    let reportFilter;
    ReportOrder.findOne = (filter) => {
      reportFilter = filter;
      return makePopulateQuery({
        _id: sourceId,
        paymentStatus: "paid",
        razorpayOrderId: "rzp-report",
      });
    };
    Transaction.find = (filter) => {
      assert.deepEqual(filter, {
        report: sourceId,
        transactionType: "report",
        status: "success",
        razorpayOrderId: "rzp-report",
      });
      return makeLeanQuery([
        { _id: transactionId, status: "success", razorpayOrderId: "rzp-report" },
      ]);
    };
    Invoice.findOne = () =>
      makeLeanQuery({
        sourceType: "report",
        sourceId,
        transaction: transactionId,
        invoiceNumber: "INV-AS/42",
      });

    const response = makeResponse();
    await reportController.downloadReportInvoice(
      { params: { orderId: sourceId.toString() }, user: { _id: userId } },
      response,
      (error) => {
        throw error;
      },
    );

    assert.deepEqual(reportFilter, {
      _id: sourceId.toString(),
      userId,
    });
    assert.ok(response.body);
    if (reportTemplateArgs) {
      assert.equal(reportTemplateArgs[0].invoiceNumber, "INV-AS/42");
    }
    assert.equal(response.body.length, 1001);

  });

  it("returns a safe error for an ambiguous Report transaction", async () => {
    resetTestObservations();
    ReportOrder.findOne = () =>
      makePopulateQuery({
        _id: sourceId,
        paymentStatus: "paid",
        razorpayOrderId: "rzp-report",
      });
    Transaction.find = () =>
      makeLeanQuery([
        { _id: transactionId },
        { _id: new mongoose.Types.ObjectId() },
      ]);

    const response = makeResponse();
    await reportController.downloadReportInvoice(
      { params: { orderId: sourceId.toString() }, user: { _id: userId } },
      response,
      () => {},
    );

    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /ambiguous/i);
    assert.equal(generatedPdfCount, 0);
  });

  it("keeps GST calculations and uses null for ordinary GST invoice numbers", async () => {
    Transaction.find = () => {
      const query = {
        populate() {
          return query;
        },
        sort() {
          return query;
        },
        lean: async () => [
          {
            _id: transactionId,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            transactionType: "order",
            amount: 118,
            tax: 18,
            taxRate: 18,
            taxInclusive: false,
            currency: "INR",
            user: { email: "customer@example.com" },
          },
        ],
      };
      return query;
    };

    const response = makeResponse();
    await transactionController.getGstReport(
      { query: {} },
      response,
      (error) => {
        throw error;
      },
    );

    assert.equal(response.statusCode, null);
    assert.equal(response.body.data.rows[0].invoiceNo, null);
    assert.equal(response.body.data.rows[0].totalAmount, 118);
    assert.equal(response.body.data.rows[0].gstAmount, 18);
    assert.equal(response.body.data.rows[0].taxableAmount, 100);
  });
});
