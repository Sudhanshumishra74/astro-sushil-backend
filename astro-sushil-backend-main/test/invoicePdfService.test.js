import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";

import { Invoice } from "../src/modules/Invoice/invoice.model.js";
import { findInvoiceForPdf } from "../src/service/invoicePdfService.js";
import { generateInvoiceTemplate } from "../src/utils/invoice.template.js";
import { generateBookingInvoiceTemplate } from "../src/utils/generateBookingInvoiceTemplate.js";
import { generateReportInvoiceTemplate } from "../src/utils/generateReportInvoiceTemplate.js";

const originalFindOne = Invoice.findOne;

afterEach(() => {
  Invoice.findOne = originalFindOne;
});

const ids = {
  source: new mongoose.Types.ObjectId(),
  transaction: new mongoose.Types.ObjectId(),
};

const persistedInvoice = {
  sourceType: "order",
  sourceId: ids.source,
  transaction: ids.transaction,
  invoiceNumber: "INV-AS/42",
};

describe("findInvoiceForPdf", () => {
  it("reads a persisted invoice by source and validates its transaction", async () => {
    let filter;
    Invoice.findOne = (query) => {
      filter = query;
      return { lean: async () => persistedInvoice };
    };

    const invoice = await findInvoiceForPdf({
      sourceType: "order",
      sourceId: ids.source,
      transactionId: ids.transaction,
    });

    assert.deepEqual(filter, {
      sourceType: "order",
      sourceId: ids.source,
    });
    assert.equal(invoice.invoiceNumber, "INV-AS/42");
  });

  it("returns null for a missing historical invoice without allocating", async () => {
    let lookupCount = 0;
    Invoice.findOne = () => ({
      lean: async () => {
        lookupCount += 1;
        return null;
      },
    });

    const invoice = await findInvoiceForPdf({
      sourceType: "booking",
      sourceId: ids.source,
      transactionId: ids.transaction,
    });

    assert.equal(invoice, null);
    assert.equal(lookupCount, 1);
  });

  it("fails safely for an inconsistent persisted invoice", async () => {
    Invoice.findOne = () => ({
      lean: async () => ({
        ...persistedInvoice,
        sourceType: "booking",
      }),
    });

    await assert.rejects(
      findInvoiceForPdf({
        sourceType: "order",
        sourceId: ids.source,
        transactionId: ids.transaction,
      }),
      /inconsistent with its source/,
    );
  });

  it("fails safely when a persisted invoice has no linked transaction", async () => {
    Invoice.findOne = () => ({
      lean: async () => ({ ...persistedInvoice, transaction: null }),
    });

    await assert.rejects(
      findInvoiceForPdf({
        sourceType: "order",
        sourceId: ids.source,
        transactionId: ids.transaction,
      }),
      /inconsistent with its source/,
    );
  });
});

describe("invoice PDF templates", () => {
  it("renders the persisted Order invoice number", () => {
    const html = generateInvoiceTemplate(
      { _id: ids.source, items: [], totalAmount: 0 },
      "INV-AS/42",
    );

    assert.match(html, /INV-AS\/42/);
    assert.doesNotMatch(html, /INV-[A-F0-9]{8}/);
  });

  it("renders the persisted Booking invoice number", () => {
    const html = generateBookingInvoiceTemplate(
      { _id: ids.source },
      "INV-AS/42",
    );

    assert.match(html, /INV-AS\/42/);
    assert.doesNotMatch(html, /INV-[A-F0-9]{8}/);
  });

  it("renders the persisted Report invoice number", () => {
    const html = generateReportInvoiceTemplate({
      order: { _id: ids.source },
      transaction: {},
      user: {},
      invoiceNumber: "INV-AS/42",
    });

    assert.match(html, /INV-AS\/42/);
    assert.doesNotMatch(html, /INV-[A-F0-9]{8}/);
  });
});
