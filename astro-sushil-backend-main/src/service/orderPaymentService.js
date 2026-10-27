import { Order } from "../modules/Order/order.model.js";
import { Transaction } from "../modules/Transaction/Transaction.model.js";
import { allocateInvoiceInTransaction } from "./invoiceAllocator.js";

export const claimOrderPaymentWithInvoice = async ({
  orderId,
  transactionId = null,
  razorpayPaymentId,
  razorpayOrderId,
  session,
}) => {
  if (!session?.inTransaction()) {
    throw new Error(
      "Order payment claim requires an active MongoDB transaction",
    );
  }

  const order = await Order.findOneAndUpdate(
    { _id: orderId, "payment.status": { $ne: "paid" } },
    {
      $set: {
        "payment.status": "paid",
        "payment.transactionId": razorpayPaymentId,
        "payment.razorpayOrderId": razorpayOrderId,
        orderStatus: "placed",
      },
    },
    { new: true, session },
  );

  if (!order) {
    return {
      claimed: false,
      order: null,
      transaction: null,
      invoice: null,
    };
  }

  const transactionQuery = transactionId
    ? Transaction.findById(transactionId)
    : Transaction.findOne({
        order: order._id,
        transactionType: "order",
      });
  const transaction = await transactionQuery.session(session);

  if (!transaction) {
    throw new Error("Order payment transaction not found");
  }

  if (
    String(transaction.razorpayOrderId || "") !==
    String(razorpayOrderId || "")
  ) {
    throw new Error("Razorpay order ID does not match the Order transaction");
  }

  const updatedTransaction = await Transaction.findOneAndUpdate(
    { _id: transaction._id },
    {
      $set: {
        status: "success",
        transactionId: razorpayPaymentId,
        razorpayOrderId,
      },
    },
    { new: true, session },
  );

  if (!updatedTransaction) {
    throw new Error("Order payment transaction update failed");
  }

  const invoice = await allocateInvoiceInTransaction({
    sourceType: "order",
    sourceId: order._id,
    transactionId: updatedTransaction._id,
    session,
  });

  return {
    claimed: true,
    order,
    transaction: updatedTransaction,
    invoice,
  };
};
