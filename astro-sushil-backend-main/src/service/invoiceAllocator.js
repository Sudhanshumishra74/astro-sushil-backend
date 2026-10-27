import mongoose from "mongoose";

import { Invoice } from "../modules/Invoice/invoice.model.js";
import { InvoiceCounter } from "../modules/Invoice/invoiceCounter.model.js";

const DEFAULT_MAX_ATTEMPTS = 3;
const INVOICE_COUNTER_ID = "invoice";
const SOURCE_REFERENCE_INDEX = "sourceType_sourceId_unique";
const INVOICE_NUMBER_INDEX = "invoiceNumber_unique";

const isKeyPattern = (error, expected) =>
  Object.keys(error?.keyPattern || {}).join(",") === expected;

const classifyDuplicateKeyError = (error) => {
  if (error?.code !== 11000) {
    return null;
  }

  if (
    error?.index === SOURCE_REFERENCE_INDEX ||
    isKeyPattern(error, "sourceType,sourceId")
  ) {
    return "source-reference";
  }

  if (
    error?.index === INVOICE_NUMBER_INDEX ||
    isKeyPattern(error, "invoiceNumber")
  ) {
    return "invoice-number";
  }

  return "unknown";
};

const isTransientTransactionError = (error) =>
  error?.errorLabels?.includes("TransientTransactionError") ||
  error?.errorLabels?.includes("UnknownTransactionCommitResult");

export const formatInvoiceNumber = (sequence) => {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Invoice sequence must be a positive integer");
  }

  return `INV-AS/${
    sequence < 10 ? String(sequence).padStart(2, "0") : sequence
  }`;
};

const validateSource = ({ sourceType, sourceId }) => {
  if (!["order", "booking", "report"].includes(sourceType)) {
    throw new Error(`Unsupported invoice source type: ${sourceType}`);
  }

  if (!mongoose.Types.ObjectId.isValid(sourceId)) {
    throw new Error("Invoice sourceId must be a valid ObjectId");
  }
};

export const allocateInvoiceInTransaction = async ({
  sourceType,
  sourceId,
  transactionId = null,
  session,
}) => {
  validateSource({ sourceType, sourceId });

  if (!session?.inTransaction()) {
    throw new Error(
      "Invoice allocation requires an active MongoDB transaction",
    );
  }

  const existingInvoice = await Invoice.findOne({
    sourceType,
    sourceId,
  }).session(session);

  if (existingInvoice) {
    return existingInvoice;
  }

  const counter = await InvoiceCounter.findOneAndUpdate(
    { _id: INVOICE_COUNTER_ID },
    { $inc: { nextSequence: 1 } },
    { new: true, session },
  );

  if (!counter) {
    throw new Error(
      "Invoice counter is not initialized; allocation aborted",
    );
  }

  const [invoice] = await Invoice.create(
    [
      {
        sequence: counter.nextSequence,
        invoiceNumber: formatInvoiceNumber(counter.nextSequence),
        sourceType,
        sourceId,
        transaction: transactionId,
      },
    ],
    { session },
  );

  return invoice;
};

const loadExistingInvoice = async ({ sourceType, sourceId }) => {
  return Invoice.findOne({ sourceType, sourceId }).lean();
};

export const allocateInvoiceWithRetry = async ({
  sourceType,
  sourceId,
  transactionId = null,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}) => {
  validateSource({ sourceType, sourceId });

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const session = await mongoose.startSession();
    let sessionEnded = false;

    try {
      let invoice;

      await session.withTransaction(async () => {
        invoice = await allocateInvoiceInTransaction({
          sourceType,
          sourceId,
          transactionId,
          session,
        });
      });

      return invoice;
    } catch (error) {
      const duplicateType = classifyDuplicateKeyError(error);
      const sourceReferenceRace = duplicateType === "source-reference";
      const retryable =
        sourceReferenceRace ||
        (duplicateType === null && isTransientTransactionError(error));

      if (!retryable || attempt === maxAttempts) {
        throw error;
      }

      await session.endSession();
      sessionEnded = true;

      if (sourceReferenceRace) {
        const existingInvoice = await loadExistingInvoice({
          sourceType,
          sourceId,
        });

        if (existingInvoice) {
          return existingInvoice;
        }
      }
    } finally {
      if (!sessionEnded) {
        await session.endSession();
      }
    }
  }

  throw new Error("Invoice allocation failed unexpectedly");
};
