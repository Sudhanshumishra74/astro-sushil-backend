import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import fs from "node:fs/promises";
import mongoose from "mongoose";

import { Order } from "../src/modules/Order/order.model.js";
import { Transaction } from "../src/modules/Transaction/Transaction.model.js";
import { Invoice } from "../src/modules/Invoice/invoice.model.js";
import { InvoiceCounter } from "../src/modules/Invoice/invoiceCounter.model.js";
import { claimOrderPaymentWithInvoice } from "../src/service/orderPaymentService.js";

const sourceId = new mongoose.Types.ObjectId();
const transactionId = new mongoose.Types.ObjectId();

const originals = {
  orderFindOneAndUpdate: Order.findOneAndUpdate,
  transactionFindById: Transaction.findById,
  transactionFindOne: Transaction.findOne,
  transactionFindOneAndUpdate: Transaction.findOneAndUpdate,
  invoiceFindOne: Invoice.findOne,
  invoiceCreate: Invoice.create,
  counterFindOneAndUpdate: InvoiceCounter.findOneAndUpdate,
};

const makeQuery = (value, sessionRecorder = null) => ({
  session(session) {
    sessionRecorder?.push(session);
    return Promise.resolve(value);
  },
});

const makeSession = () => ({
  inTransaction: () => true,
});

const restoreStubs = () => {
  Order.findOneAndUpdate = originals.orderFindOneAndUpdate;
  Transaction.findById = originals.transactionFindById;
  Transaction.findOne = originals.transactionFindOne;
  Transaction.findOneAndUpdate = originals.transactionFindOneAndUpdate;
  Invoice.findOne = originals.invoiceFindOne;
  Invoice.create = originals.invoiceCreate;
  InvoiceCounter.findOneAndUpdate = originals.counterFindOneAndUpdate;
};

afterEach(restoreStubs);

const setupSuccessfulClaim = ({
  claimedOrder = { _id: sourceId },
  linkedTransaction = { _id: transactionId, razorpayOrderId: "order_123" },
  updatedTransaction = { _id: transactionId },
  invoice = { invoiceNumber: "INV-AS/01" },
} = {}) => {
  const sessions = [];
  let orderFilter;
  let orderUpdate;
  let orderOptions;
  let transactionLookupFilter;
  let transactionUpdateFilter;
  let transactionUpdate;
  let transactionUpdateOptions;

  Order.findOneAndUpdate = (filter, update, options) => {
    orderFilter = filter;
    orderUpdate = update;
    orderOptions = options;
    return Promise.resolve(claimedOrder);
  };
  Transaction.findOne = (filter) => {
    transactionLookupFilter = filter;
    return makeQuery(linkedTransaction, sessions);
  };
  Transaction.findOneAndUpdate = (filter, update, options) => {
    transactionUpdateFilter = filter;
    transactionUpdate = update;
    transactionUpdateOptions = options;
    return Promise.resolve(updatedTransaction);
  };
  Invoice.findOne = () => makeQuery(null, sessions);
  InvoiceCounter.findOneAndUpdate = async () => ({ nextSequence: 1 });
  Invoice.create = async (documents, options) => {
    assert.deepEqual(documents[0], {
      sequence: 1,
      invoiceNumber: "INV-AS/01",
      sourceType: "order",
      sourceId: sourceId,
      transaction: transactionId,
    });
    assert.strictEqual(options.session, currentSession);
    return [invoice];
  };

  let currentSession;

  return {
    sessions,
    setSession(session) {
      currentSession = session;
    },
    getArguments() {
      return {
        orderFilter,
        orderUpdate,
        orderOptions,
        transactionLookupFilter,
        transactionUpdateFilter,
        transactionUpdate,
        transactionUpdateOptions,
      };
    },
  };
};

describe("claimOrderPaymentWithInvoice", () => {
  it("claims, updates the exact transaction, and allocates with the same session", async () => {
    const session = makeSession();
    const setup = setupSuccessfulClaim();
    setup.setSession(session);

    const result = await claimOrderPaymentWithInvoice({
      orderId: sourceId,
      razorpayPaymentId: "pay_123",
      razorpayOrderId: "order_123",
      session,
    });

    const args = setup.getArguments();
    assert.equal(result.claimed, true);
    assert.equal(result.invoice.invoiceNumber, "INV-AS/01");
    assert.deepEqual(args.orderFilter, {
      _id: sourceId,
      "payment.status": { $ne: "paid" },
    });
    assert.deepEqual(args.orderUpdate, {
      $set: {
        "payment.status": "paid",
        "payment.transactionId": "pay_123",
        "payment.razorpayOrderId": "order_123",
        orderStatus: "placed",
      },
    });
    assert.strictEqual(args.orderOptions.session, session);
    assert.deepEqual(args.transactionLookupFilter, {
      order: sourceId,
      transactionType: "order",
    });
    assert.deepEqual(args.transactionUpdateFilter, { _id: transactionId });
    assert.deepEqual(args.transactionUpdate, {
      $set: {
        status: "success",
        transactionId: "pay_123",
        razorpayOrderId: "order_123",
      },
    });
    assert.strictEqual(args.transactionUpdateOptions.session, session);
    assert.deepEqual(setup.sessions, [session, session]);
  });

  it("does not touch Transaction or Invoice when the Order claim is null", async () => {
    const session = makeSession();
    let transactionCalls = 0;
    let invoiceCalls = 0;

    Order.findOneAndUpdate = async () => null;
    Transaction.findOne = () => {
      transactionCalls += 1;
      return makeQuery(null);
    };
    Transaction.findOneAndUpdate = async () => {
      transactionCalls += 1;
      return null;
    };
    Invoice.findOne = () => {
      invoiceCalls += 1;
      return makeQuery(null);
    };

    const result = await claimOrderPaymentWithInvoice({
      orderId: sourceId,
      razorpayPaymentId: "pay_123",
      razorpayOrderId: "order_123",
      session,
    });

    assert.deepEqual(result, {
      claimed: false,
      order: null,
      transaction: null,
      invoice: null,
    });
    assert.equal(transactionCalls, 0);
    assert.equal(invoiceCalls, 0);
  });

  it("fails closed when the linked Transaction is missing", async () => {
    const session = makeSession();
    Order.findOneAndUpdate = async () => ({ _id: sourceId });
    Transaction.findOne = () => makeQuery(null);

    await assert.rejects(
      claimOrderPaymentWithInvoice({
        orderId: sourceId,
        razorpayPaymentId: "pay_123",
        razorpayOrderId: "order_123",
        session,
      }),
      /transaction not found/,
    );
  });

  it("fails closed when the Transaction update returns null", async () => {
    const session = makeSession();
    Order.findOneAndUpdate = async () => ({ _id: sourceId });
    Transaction.findOne = () =>
      makeQuery({ _id: transactionId, razorpayOrderId: "order_123" });
    Transaction.findOneAndUpdate = async () => null;

    await assert.rejects(
      claimOrderPaymentWithInvoice({
        orderId: sourceId,
        razorpayPaymentId: "pay_123",
        razorpayOrderId: "order_123",
        session,
      }),
      /transaction update failed/,
    );
  });

  it("propagates allocator failure without ending or aborting the caller session", async () => {
    const session = makeSession();
    let sessionEnded = false;
    let transactionAborted = false;
    session.endSession = async () => {
      sessionEnded = true;
    };
    session.abortTransaction = async () => {
      transactionAborted = true;
    };
    Order.findOneAndUpdate = async () => ({ _id: sourceId });
    Transaction.findOne = () =>
      makeQuery({ _id: transactionId, razorpayOrderId: "order_123" });
    Transaction.findOneAndUpdate = async () => ({ _id: transactionId });
    Invoice.findOne = () => makeQuery(null);
    InvoiceCounter.findOneAndUpdate = async () => ({ nextSequence: 1 });
    Invoice.create = async () => {
      throw new Error("invoice allocation failed");
    };

    await assert.rejects(
      claimOrderPaymentWithInvoice({
        orderId: sourceId,
        razorpayPaymentId: "pay_123",
        razorpayOrderId: "order_123",
        session,
      }),
      /invoice allocation failed/,
    );
    assert.equal(sessionEnded, false);
    assert.equal(transactionAborted, false);
  });
});

describe("Order Razorpay integration wiring", () => {
  it("uses the shared helper from client verification and the Order webhook branch", async () => {
    const controller = await fs.readFile(
      new URL("../src/modules/Order/order.controller.js", import.meta.url),
      "utf8",
    );
    const webhook = await fs.readFile(
      new URL("../src/webhooks/razorpay.js", import.meta.url),
      "utf8",
    );

    assert.match(
      controller,
      /import \{ claimOrderPaymentWithInvoice \} from "\.\.\/\.\.\/service\/orderPaymentService\.js";/,
    );
    assert.match(controller, /claimResult = await claimOrderPaymentWithInvoice\(/);
    assert.match(
      webhook,
      /import \{ claimOrderPaymentWithInvoice \} from "\.\.\/service\/orderPaymentService\.js";/,
    );
    assert.match(
      webhook,
      /const claimResult = await claimOrderPaymentWithInvoice\(/,
    );
  });
});
