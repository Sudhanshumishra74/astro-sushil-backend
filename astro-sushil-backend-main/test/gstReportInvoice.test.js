import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";
import mongoose from "mongoose";

const ids = {
  order: new mongoose.Types.ObjectId(),
  booking: new mongoose.Types.ObjectId(),
  report: new mongoose.Types.ObjectId(),
  missing: new mongoose.Types.ObjectId(),
  unrelated: new mongoose.Types.ObjectId(),
};

const transactions = [
  {
    _id: ids.order,
    transactionType: "order",
    order: { _id: ids.order },
    amount: 118,
    tax: 18,
    currency: "INR",
    status: "success",
    method: "razorpay",
  },
  {
    _id: ids.booking,
    transactionType: "consultation",
    booking: { _id: ids.booking },
    amount: 100,
    baseAmount: 100,
    tax: 18,
    exchangeRate: 1,
    status: "success",
    method: "razorpay",
  },
  {
    _id: ids.report,
    transactionType: "report",
    report: { _id: ids.report },
    amount: 100,
    baseAmount: 100,
    tax: 18,
    exchangeRate: 1,
    status: "success",
    method: "razorpay",
  },
  {
    _id: ids.missing,
    transactionType: "consultation",
    booking: ids.missing,
    amount: 50,
    baseAmount: 50,
    tax: 0,
    exchangeRate: 1,
    status: "success",
    method: "manual",
  },
];

const invoices = [
  {
    sourceType: "order",
    sourceId: ids.order,
    transaction: null,
    invoiceNumber: "INV-AS/01",
  },
  {
    sourceType: "booking",
    sourceId: ids.booking,
    transaction: null,
    invoiceNumber: "INV-AS/02",
  },
  {
    sourceType: "report",
    sourceId: ids.report,
    transaction: ids.report,
    invoiceNumber: "INV-AS/03",
  },
  {
    sourceType: "report",
    sourceId: ids.unrelated,
    transaction: null,
    invoiceNumber: "INV-AS/99",
  },
];

const makeTransactionQuery = () => {
  const query = {
    populate() {
      return query;
    },
    sort() {
      return query;
    },
    lean: async () => transactions,
  };
  return query;
};

const makeInvoiceQuery = () => {
  const query = {
    select() {
      return query;
    },
    lean: async () => invoices,
  };
  return query;
};

let getGstReport;

before(async () => {
  mock.module("../src/modules/auth/user.modal.js", {
    namedExports: { User: {} },
  });
  mock.module("../src/modules/Transaction/Transaction.model.js", {
    namedExports: {
      Transaction: {
        find: () => makeTransactionQuery(),
      },
    },
  });
  mock.module("../src/modules/Invoice/invoice.model.js", {
    namedExports: {
      Invoice: {
        find: (filter) => {
          assert.equal(filter.$or.length, 5);
          return makeInvoiceQuery();
        },
      },
    },
  });

  ({ getGstReport } = await import(
    `../src/modules/Transaction/Transaction.controler.js?gst=${Date.now()}`
  ));
});

describe("GST report invoice mapping", () => {
  it("maps direct and source-linked invoices without assigning unrelated invoices", async () => {
    const response = {
      headersSent: false,
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    await getGstReport({ query: {} }, response);

    assert.equal(response.statusCode, null);
    assert.deepEqual(
      response.body.data.rows.map((row) => row.invoiceNo),
      ["INV-AS/01", "INV-AS/02", "INV-AS/03", null],
    );
    assert.deepEqual(response.body.data.summary, {
      taxableTotal: 314,
      gstTotal: 54,
      grandTotal: 368,
      count: 4,
    });
    assert.equal(response.body.data.rows[0].customerName, "—");
    assert.equal(response.body.data.rows[0].paymentStatus, "success");
  });
});
