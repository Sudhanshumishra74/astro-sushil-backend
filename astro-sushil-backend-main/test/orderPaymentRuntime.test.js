import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import crypto from "node:crypto";
import mongoose from "mongoose";

import { Order } from "../src/modules/Order/order.model.js";
import { Transaction } from "../src/modules/Transaction/Transaction.model.js";
import { Invoice } from "../src/modules/Invoice/invoice.model.js";
import { InvoiceCounter } from "../src/modules/Invoice/invoiceCounter.model.js";

const orderId = new mongoose.Types.ObjectId();
const transactionId = new mongoose.Types.ObjectId();
let clientSideEffect;
const originalMethods = {
  orderFindOneAndUpdate: Order.findOneAndUpdate,
  orderFindById: Order.findById,
  transactionFindById: Transaction.findById,
  transactionFindOne: Transaction.findOne,
  transactionFindOneAndUpdate: Transaction.findOneAndUpdate,
  invoiceFindOne: Invoice.findOne,
  invoiceCreate: Invoice.create,
  counterFindOneAndUpdate: InvoiceCounter.findOneAndUpdate,
  startSession: mongoose.startSession,
};

const makeResponse = () => ({
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
});

const makeSession = () => ({
  inTransaction: () => true,
  startTransaction() {
    this.events.push("start");
  },
  async commitTransaction() {
    this.events.push("commit");
  },
  async abortTransaction() {
    this.events.push("abort");
  },
  async endSession() {
    this.events.push("end");
  },
  events: [],
});

const makeQuery = (value) => ({
  session: async () => value,
  lean: async () => value,
});

const restoreMethods = () => {
  Order.findOneAndUpdate = originalMethods.orderFindOneAndUpdate;
  Order.findById = originalMethods.orderFindById;
  Transaction.findById = originalMethods.transactionFindById;
  Transaction.findOne = originalMethods.transactionFindOne;
  Transaction.findOneAndUpdate = originalMethods.transactionFindOneAndUpdate;
  Invoice.findOne = originalMethods.invoiceFindOne;
  Invoice.create = originalMethods.invoiceCreate;
  InvoiceCounter.findOneAndUpdate = originalMethods.counterFindOneAndUpdate;
  mongoose.startSession = originalMethods.startSession;
};

const mockControllerDependencies = async () => {
  const moduleMocks = [
    ["../src/queues/notification.queue.js", { notificationQueue: { add: async () => {} } }],
    [
      "../src/modules/Download/download.controller.js",
      {
        createDownloadsFromOrder: async () => {
          await clientSideEffect?.();
        },
      },
    ],
    ["../src/modules/cart/cart.modal.js", { defaultExport: { findOneAndUpdate: async () => {} } }],
    ["../src/modules/coupon/coupon.model.js", { Coupon: { findOneAndUpdate: async () => {} } }],
    [
      "../src/modules/auth/user.modal.js",
      {
        User: {
          findById: () => ({
            select: () => ({ lean: async () => null }),
          }),
        },
      },
    ],
    ["../src/utils/exchangeRate.js", { getRateFor: async () => 1 }],
    ["../src/utils/razorpay.js", { createRazorpayOrder: async () => ({}) }],
    ["../src/utils/invoice.template.js", { generateInvoiceTemplate: () => "" }],
    ["puppeteer", { defaultExport: {} }],
  ];

  for (const [specifier, exports] of moduleMocks) {
    if (exports.defaultExport) {
      mock.module(specifier, { defaultExport: exports.defaultExport });
    } else {
      mock.module(specifier, { namedExports: exports });
    }
  }
};

const importOrderController = async () => {
  await mockControllerDependencies();
  return import(`../src/modules/Order/order.controller.js?runtime=${Date.now()}`);
};

let webhookSideEffect;

const importWebhook = async () => {
  mock.module("../src/modules/Order/order.controller.js", {
    namedExports: {
      reduceStock: async () => {
        await webhookSideEffect();
      },
    },
  });
  mock.module("../src/modules/Reports/report.controller.js", {
    namedExports: { generateReportAfterPayment: async () => {} },
  });
  return import(`../src/webhooks/razorpay.js?runtime=${Date.now()}`);
};

const signWebhook = (body, secret) =>
  crypto.createHmac("sha256", secret).update(body).digest("hex");

let controller;
let webhook;

before(async () => {
  process.env.RAZORPAY_KEY_SECRET = "test-key";
  process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret";
  controller = await importOrderController();
  webhook = await importWebhook();
});

after(() => {
  restoreMethods();
  mock.restoreAll();
});

describe("verifyPayment runtime behavior", () => {
  it("commits before running winner-only side effects", async () => {
    const session = makeSession();
    const order = { _id: orderId, items: [], orderType: "digital", payment: {} };
    const transaction = {
      _id: transactionId,
      order: orderId,
      transactionType: "order",
      razorpayOrderId: "rzp_order",
    };
    const events = session.events;
    clientSideEffect = async () => {
      events.push("side-effect");
      assert.equal(events.includes("commit"), true);
    };

    mongoose.startSession = async () => session;
    Order.findOneAndUpdate = async () => order;
    Transaction.findOne = () => makeQuery(transaction);
    Transaction.findOneAndUpdate = async () => transaction;
    Invoice.findOne = () => makeQuery(null);
    InvoiceCounter.findOneAndUpdate = async () => ({ nextSequence: 1 });
    Invoice.create = async () => [{ invoiceNumber: "INV-AS/01" }];

    const response = makeResponse();
    const next = () => {};
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update("rzp_order|rzp_payment")
      .digest("hex");

    await controller.verifyPayment(
      {
        body: {
          orderId: orderId.toString(),
          razorpay_payment_id: "rzp_payment",
          razorpay_order_id: "rzp_order",
          razorpay_signature: signature,
        },
      },
      response,
      next,
    );

    assert.deepEqual(events, ["start", "commit", "end", "side-effect"]);
    assert.equal(response.statusCode, null);
    assert.equal(events.indexOf("commit") < events.indexOf("end"), true);
  });

  it("fails closed for a mismatched Razorpay order ID before invoice allocation", async () => {
    const session = makeSession();
    let invoiceCalls = 0;

    mongoose.startSession = async () => session;
    Order.findOneAndUpdate = async () => ({ _id: orderId });
    Transaction.findOne = () =>
      makeQuery({ _id: transactionId, razorpayOrderId: "different-order" });
    Invoice.findOne = () => {
      invoiceCalls += 1;
      return makeQuery(null);
    };

    const response = makeResponse();
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update("rzp_order|rzp_payment")
      .digest("hex");

    await controller.verifyPayment(
      {
        body: {
          orderId: orderId.toString(),
          razorpay_payment_id: "rzp_payment",
          razorpay_order_id: "rzp_order",
          razorpay_signature: signature,
        },
      },
      response,
      () => {},
    );

    assert.equal(response.statusCode, 500);
    assert.deepEqual(session.events, ["start", "abort", "end"]);
    assert.equal(invoiceCalls, 0);
  });

  it("commits a duplicate claim without allocating or running winner-only effects", async () => {
    const session = makeSession();
    let invoiceCalls = 0;
    let sideEffectCalls = 0;
    clientSideEffect = async () => {
      sideEffectCalls += 1;
    };
    mongoose.startSession = async () => session;
    Order.findOneAndUpdate = async () => null;
    Order.findById = () => makeQuery({ _id: orderId });
    Invoice.findOne = () => {
      invoiceCalls += 1;
      return makeQuery(null);
    };

    const response = makeResponse();
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update("rzp_order|rzp_payment")
      .digest("hex");

    await controller.verifyPayment(
      {
        body: {
          orderId: orderId.toString(),
          razorpay_payment_id: "rzp_payment",
          razorpay_order_id: "rzp_order",
          razorpay_signature: signature,
        },
      },
      response,
      () => {},
    );

    assert.equal(response.statusCode, null);
    assert.deepEqual(session.events, ["start", "commit", "end"]);
    assert.equal(invoiceCalls, 0);
    assert.equal(sideEffectCalls, 0);
  });

  it("aborts and does not return success when allocation fails", async () => {
    const session = makeSession();
    mongoose.startSession = async () => session;
    Order.findOneAndUpdate = async () => ({ _id: orderId });
    Transaction.findOne = () =>
      makeQuery({ _id: transactionId, razorpayOrderId: "rzp_order" });
    Transaction.findOneAndUpdate = async () => ({ _id: transactionId });
    Invoice.findOne = () => makeQuery(null);
    InvoiceCounter.findOneAndUpdate = async () => ({ nextSequence: 1 });
    Invoice.create = async () => {
      throw new Error("allocation failed");
    };

    const response = makeResponse();
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update("rzp_order|rzp_payment")
      .digest("hex");

    await controller.verifyPayment(
      {
        body: {
          orderId: orderId.toString(),
          razorpay_payment_id: "rzp_payment",
          razorpay_order_id: "rzp_order",
          razorpay_signature: signature,
        },
      },
      response,
      () => {},
    );

    assert.equal(response.statusCode, 500);
    assert.deepEqual(session.events, ["start", "abort", "end"]);
  });
});

describe("Order Razorpay webhook runtime behavior", () => {
  const makeWebhookRequest = () => {
    const body = Buffer.from(
      JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              order_id: "rzp_order",
              id: "rzp_payment",
            },
          },
        },
      }),
    );

    return {
      body,
      headers: {
        "x-razorpay-signature": signWebhook(body, "webhook-secret"),
      },
    };
  };

  it("commits before afterOrderClaim runs", async () => {
    const session = makeSession();
    const events = session.events;
    webhookSideEffect = async () => {
      events.push("side-effect");
      assert.equal(events.includes("commit"), true);
    };
    mongoose.startSession = async () => session;
    Transaction.findOne = () =>
      makeQuery({
        _id: transactionId,
        order: orderId,
        transactionType: "order",
        razorpayOrderId: "rzp_order",
      });
    Transaction.findById = () =>
      makeQuery({
        _id: transactionId,
        razorpayOrderId: "rzp_order",
      });
    Order.findOneAndUpdate = async () => ({ _id: orderId, items: [], orderType: "digital" });
    Transaction.findOneAndUpdate = async () => ({ _id: transactionId });
    Invoice.findOne = () => makeQuery(null);
    InvoiceCounter.findOneAndUpdate = async () => ({ nextSequence: 1 });
    Invoice.create = async () => [{ invoiceNumber: "INV-AS/01" }];

    const response = makeResponse();
    await webhook.razorpayWebhook(makeWebhookRequest(), response);

    assert.deepEqual(events, ["start", "commit", "end", "side-effect"]);
    assert.equal(response.statusCode, 200);
  });

  it("returns the retryable error response when webhook allocation fails", async () => {
    const session = makeSession();
    webhookSideEffect = async () => {
      throw new Error("winner-only side effect should not run");
    };
    mongoose.startSession = async () => session;
    Transaction.findOne = () =>
      makeQuery({
        _id: transactionId,
        order: orderId,
        transactionType: "order",
        razorpayOrderId: "rzp_order",
      });
    Transaction.findById = () =>
      makeQuery({
        _id: transactionId,
        razorpayOrderId: "rzp_order",
      });
    Order.findOneAndUpdate = async () => ({ _id: orderId });
    Transaction.findOneAndUpdate = async () => ({ _id: transactionId });
    Invoice.findOne = () => makeQuery(null);
    InvoiceCounter.findOneAndUpdate = async () => ({ nextSequence: 1 });
    Invoice.create = async () => {
      throw new Error("allocation failed");
    };

    const response = makeResponse();
    await webhook.razorpayWebhook(makeWebhookRequest(), response);

    assert.equal(response.statusCode, 500);
    assert.deepEqual(session.events, ["start", "abort", "end"]);
  });

  it("does not allocate or run winner-only effects for a duplicate webhook", async () => {
    const session = makeSession();
    let allocatorCalls = 0;
    let sideEffectCalls = 0;
    webhookSideEffect = async () => {
      sideEffectCalls += 1;
    };
    mongoose.startSession = async () => session;
    Transaction.findOne = () =>
      makeQuery({
        _id: transactionId,
        order: orderId,
        transactionType: "order",
        razorpayOrderId: "rzp_order",
      });
    Order.findOneAndUpdate = async () => null;
    Invoice.findOne = () => {
      allocatorCalls += 1;
      return makeQuery(null);
    };

    const response = makeResponse();
    await webhook.razorpayWebhook(makeWebhookRequest(), response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(session.events, ["start", "commit", "end"]);
    assert.equal(allocatorCalls, 0);
    assert.equal(sideEffectCalls, 0);
  });
});
