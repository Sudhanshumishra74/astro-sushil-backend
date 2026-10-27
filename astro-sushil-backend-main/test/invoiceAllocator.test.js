import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";

import {
  allocateInvoiceInTransaction,
  allocateInvoiceWithRetry,
  formatInvoiceNumber,
} from "../src/service/invoiceAllocator.js";
import { Invoice } from "../src/modules/Invoice/invoice.model.js";
import { InvoiceCounter } from "../src/modules/Invoice/invoiceCounter.model.js";

const sourceId = new mongoose.Types.ObjectId();
const sourceIdValue = sourceId.toString();

const originalInvoiceFindOne = Invoice.findOne;
const originalInvoiceCreate = Invoice.create;
const originalCounterFindOneAndUpdate = InvoiceCounter.findOneAndUpdate;
const originalStartSession = mongoose.startSession;

const makeQuery = (value, sessionRecorder = null) => ({
  session(session) {
    sessionRecorder?.push(session);
    return Promise.resolve(value);
  },
});

const makeSession = ({ inTransaction = true, withTransaction } = {}) => {
  const session = {
    endSession: async () => {
      session.endCount = (session.endCount || 0) + 1;
    },
    inTransaction: () => inTransaction,
    withTransaction:
      withTransaction ||
      (async (callback) => {
        await callback();
      }),
    endCount: 0,
  };

  return session;
};

const restoreStubs = () => {
  Invoice.findOne = originalInvoiceFindOne;
  Invoice.create = originalInvoiceCreate;
  InvoiceCounter.findOneAndUpdate = originalCounterFindOneAndUpdate;
  mongoose.startSession = originalStartSession;
};

afterEach(restoreStubs);

describe("formatInvoiceNumber", () => {
  it("formats single-digit, boundary, and larger sequences", () => {
    assert.equal(formatInvoiceNumber(1), "INV-AS/01");
    assert.equal(formatInvoiceNumber(9), "INV-AS/09");
    assert.equal(formatInvoiceNumber(10), "INV-AS/10");
    assert.equal(formatInvoiceNumber(99), "INV-AS/99");
    assert.equal(formatInvoiceNumber(100), "INV-AS/100");
    assert.equal(formatInvoiceNumber(101), "INV-AS/101");
  });

  it("rejects non-positive and non-integer sequences", () => {
    for (const value of [0, -1, 1.5, Number.NaN, "1"]) {
      assert.throws(() => formatInvoiceNumber(value), /positive integer/);
    }
  });
});

describe("allocateInvoiceInTransaction", () => {
  it("accepts supported sources and rejects invalid source types or ids", async () => {
    const session = makeSession();
    Invoice.findOne = () => makeQuery(null);
    InvoiceCounter.findOneAndUpdate = async () => ({ nextSequence: 1 });
    Invoice.create = async () => [
      { invoiceNumber: "INV-AS/01", sourceType: "order" },
    ];

    for (const sourceType of ["order", "booking", "report"]) {
      const invoice = await allocateInvoiceInTransaction({
        sourceType,
        sourceId: sourceIdValue,
        session,
      });
      assert.equal(invoice.invoiceNumber, "INV-AS/01");
    }

    await assert.rejects(
      allocateInvoiceInTransaction({
        sourceType: "gst-summary",
        sourceId: sourceIdValue,
        session,
      }),
      /Unsupported invoice source type/,
    );
    await assert.rejects(
      allocateInvoiceInTransaction({
        sourceType: "order",
        sourceId: "not-an-object-id",
        session,
      }),
      /valid ObjectId/,
    );
  });

  it("requires an active caller-owned transaction", async () => {
    const session = makeSession({ inTransaction: false });

    await assert.rejects(
      allocateInvoiceInTransaction({
        sourceType: "order",
        sourceId: sourceIdValue,
        session,
      }),
      /active MongoDB transaction/,
    );
  });

  it("returns an existing invoice without incrementing or creating", async () => {
    const session = makeSession();
    const existingInvoice = {
      invoiceNumber: "INV-AS/07",
      sourceType: "order",
      sourceId,
    };
    let lookupFilter;
    let counterCalls = 0;
    let createCalls = 0;

    Invoice.findOne = (filter) => {
      lookupFilter = filter;
      return makeQuery(existingInvoice);
    };
    InvoiceCounter.findOneAndUpdate = async () => {
      counterCalls += 1;
      return { nextSequence: 8 };
    };
    Invoice.create = async () => {
      createCalls += 1;
      return [existingInvoice];
    };

    const result = await allocateInvoiceInTransaction({
      sourceType: "order",
      sourceId,
      session,
    });

    assert.strictEqual(result, existingInvoice);
    assert.deepEqual(lookupFilter, {
      sourceType: "order",
      sourceId,
    });
    assert.equal(counterCalls, 0);
    assert.equal(createCalls, 0);
  });

  it("uses the same session for lookup, counter increment, and invoice creation", async () => {
    const session = makeSession();
    const lookupSessions = [];
    let lookupFilter;
    let counterFilter;
    let counterUpdate;
    let counterOptions;
    let createdDocuments;
    let createOptions;

    Invoice.findOne = (filter) => {
      lookupFilter = filter;
      return makeQuery(null, lookupSessions);
    };
    InvoiceCounter.findOneAndUpdate = async (filter, update, options) => {
      counterFilter = filter;
      counterUpdate = update;
      counterOptions = options;
      return { nextSequence: 42 };
    };
    Invoice.create = async (documents, options) => {
      createdDocuments = documents;
      createOptions = options;
      return [{ invoiceNumber: "INV-AS/42" }];
    };

    const transactionId = new mongoose.Types.ObjectId();
    const result = await allocateInvoiceInTransaction({
      sourceType: "report",
      sourceId: sourceIdValue,
      transactionId,
      session,
    });

    assert.equal(result.invoiceNumber, "INV-AS/42");
    assert.deepEqual(lookupFilter, {
      sourceType: "report",
      sourceId: sourceIdValue,
    });
    assert.deepEqual(lookupSessions, [session]);
    assert.deepEqual(counterFilter, { _id: "invoice" });
    assert.deepEqual(counterUpdate, { $inc: { nextSequence: 1 } });
    assert.strictEqual(counterOptions.session, session);
    assert.strictEqual(createOptions.session, session);
    assert.deepEqual(createdDocuments, [
      {
        sequence: 42,
        invoiceNumber: "INV-AS/42",
        sourceType: "report",
        sourceId: sourceIdValue,
        transaction: transactionId,
      },
    ]);
  });

  it("fails closed when the counter is missing", async () => {
    const session = makeSession();
    let createCalls = 0;

    Invoice.findOne = () => makeQuery(null);
    InvoiceCounter.findOneAndUpdate = async () => null;
    Invoice.create = async () => {
      createCalls += 1;
      return [];
    };

    await assert.rejects(
      allocateInvoiceInTransaction({
        sourceType: "order",
        sourceId: sourceIdValue,
        session,
      }),
      /counter is not initialized/,
    );
    assert.equal(createCalls, 0);
  });

  it("propagates invoice creation failures", async () => {
    const session = makeSession();
    const error = new Error("invoice write failed");

    Invoice.findOne = () => makeQuery(null);
    InvoiceCounter.findOneAndUpdate = async () => ({ nextSequence: 1 });
    Invoice.create = async () => {
      throw error;
    };

    await assert.rejects(
      allocateInvoiceInTransaction({
        sourceType: "order",
        sourceId: sourceIdValue,
        session,
      }),
      (received) => received === error,
    );
  });
});

describe("allocateInvoiceWithRetry", () => {
  it("returns an existing invoice after a source-reference race using a fresh lookup", async () => {
    const firstSession = makeSession();
    const existingInvoice = { invoiceNumber: "INV-AS/03" };
    let lookupCount = 0;
    let endedBeforeLookup = false;
    const lookupFilters = [];

    mongoose.startSession = async () => firstSession;
    Invoice.findOne = (filter) => {
      lookupFilters.push(filter);
      return {
      session: async () => {
        lookupCount += 1;
        endedBeforeLookup = firstSession.endCount === 1;
        return lookupCount === 1 ? null : existingInvoice;
      },
      lean: async () => {
        lookupCount += 1;
        endedBeforeLookup = firstSession.endCount === 1;
        return lookupCount === 1 ? null : existingInvoice;
      },
      };
    };
    InvoiceCounter.findOneAndUpdate = async () => ({ nextSequence: 3 });
    Invoice.create = async () => {
      const error = new Error("duplicate source");
      error.code = 11000;
      error.index = "sourceType_sourceId_unique";
      throw error;
    };

    const result = await allocateInvoiceWithRetry({
      sourceType: "order",
      sourceId: sourceIdValue,
    });

    assert.strictEqual(result, existingInvoice);
    assert.equal(firstSession.endCount, 1);
    assert.equal(lookupCount, 2);
    assert.equal(endedBeforeLookup, true);
    assert.deepEqual(lookupFilters, [
      { sourceType: "order", sourceId: sourceIdValue },
      { sourceType: "order", sourceId: sourceIdValue },
    ]);
  });

  it("fails closed for invoice-number and unknown duplicate keys", async () => {
    for (const duplicate of [
      { index: "invoiceNumber_unique" },
      { keyPattern: { unrelated: 1 } },
    ]) {
      const session = makeSession();
      mongoose.startSession = async () => session;
      Invoice.findOne = () => makeQuery(null);
      InvoiceCounter.findOneAndUpdate = async () => ({ nextSequence: 1 });
      Invoice.create = async () => {
        const error = new Error("duplicate");
        error.code = 11000;
        Object.assign(error, duplicate);
        throw error;
      };

      await assert.rejects(
        allocateInvoiceWithRetry({
          sourceType: "order",
          sourceId: sourceIdValue,
        }),
        /duplicate/,
      );
      assert.equal(session.endCount, 1);
    }
  });

  it("classifies a source-reference duplicate by key pattern and returns the fresh lookup", async () => {
    const session = makeSession();
    const existingInvoice = { invoiceNumber: "INV-AS/04" };
    let lookupCount = 0;
    const lookupFilters = [];

    mongoose.startSession = async () => session;
    Invoice.findOne = (filter) => {
      lookupFilters.push(filter);
      return {
        session: async () => {
          lookupCount += 1;
          return lookupCount === 1 ? null : existingInvoice;
        },
        lean: async () => existingInvoice,
      };
    };
    InvoiceCounter.findOneAndUpdate = async () => ({ nextSequence: 4 });
    Invoice.create = async () => {
      const error = new Error("duplicate source");
      error.code = 11000;
      error.keyPattern = { sourceType: 1, sourceId: 1 };
      throw error;
    };

    const result = await allocateInvoiceWithRetry({
      sourceType: "booking",
      sourceId: sourceIdValue,
    });

    assert.strictEqual(result, existingInvoice);
    assert.deepEqual(lookupFilters, [
      { sourceType: "booking", sourceId: sourceIdValue },
      { sourceType: "booking", sourceId: sourceIdValue },
    ]);
  });

  it("retries transient transaction errors through the real allocator with fresh sessions", async () => {
    const sessions = [];
    let attempts = 0;
    const operationSessions = [];

    mongoose.startSession = async () => {
      const session = makeSession({
        withTransaction: async (callback) => callback(),
      });
      sessions.push(session);
      return session;
    };
    Invoice.findOne = () => ({
      session: (session) => {
        operationSessions.push(session);
        assert.equal(session.endCount, 0);
        return Promise.resolve(null);
      },
    });
    InvoiceCounter.findOneAndUpdate = async (_filter, _update, options) => {
      attempts += 1;
      operationSessions.push(options.session);
      assert.strictEqual(options.session, sessions[attempts - 1]);
      assert.equal(options.session.endCount, 0);

      const error = new Error(`transient ${attempts}`);
      error.errorLabels = ["TransientTransactionError"];
      throw error;
    };

    await assert.rejects(
      allocateInvoiceWithRetry({
        sourceType: "booking",
        sourceId: sourceIdValue,
        maxAttempts: 3,
      }),
      /transient 3/,
    );

    assert.equal(attempts, 3);
    assert.equal(new Set(sessions).size, 3);
    assert.deepEqual(operationSessions, [
      sessions[0],
      sessions[0],
      sessions[1],
      sessions[1],
      sessions[2],
      sessions[2],
    ]);
    assert.deepEqual(
      sessions.map((session) => session.endCount),
      [1, 1, 1],
    );
  });

  it("rejects invalid retry limits before starting a session", async () => {
    let sessionCalls = 0;
    mongoose.startSession = async () => {
      sessionCalls += 1;
      return makeSession();
    };

    await assert.rejects(
      allocateInvoiceWithRetry({
        sourceType: "order",
        sourceId: sourceIdValue,
        maxAttempts: 0,
      }),
      /maxAttempts must be a positive integer/,
    );
    assert.equal(sessionCalls, 0);
  });
});


