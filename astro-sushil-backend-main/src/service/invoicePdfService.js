import { Invoice } from "../modules/Invoice/invoice.model.js";
import { ApiError } from "../utils/ApiError.js";

const sameId = (left, right) =>
  left != null && right != null && String(left) === String(right);

export const findInvoiceForPdf = async ({
  sourceType,
  sourceId,
  transactionId,
}) => {
  const invoice = await Invoice.findOne({ sourceType, sourceId }).lean();

  if (!invoice) {
    return null;
  }

  if (
    invoice.sourceType !== sourceType ||
    !sameId(invoice.sourceId, sourceId) ||
    !invoice.invoiceNumber ||
    transactionId == null ||
    !sameId(invoice.transaction, transactionId)
  ) {
    throw new ApiError(
      409,
      "Persisted invoice is inconsistent with its source",
    );
  }

  return invoice;
};
