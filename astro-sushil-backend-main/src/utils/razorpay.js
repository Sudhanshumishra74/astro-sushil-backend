import Razorpay from "razorpay";

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createRazorpayOrder = async ({ amount, currency, receipt }) => {
  return razorpay.orders.create({
    amount: Math.round(Number(amount) * 100),
    currency: currency.toUpperCase(),
    receipt,
  });
};

/**
 * Issues a refund against an already-captured Razorpay payment. Amount is
 * in the order's display currency (e.g. rupees), converted to paise here —
 * callers should never pre-multiply by 100.
 */
export const refundRazorpayPayment = async ({ paymentId, amount, notes }) => {
  return razorpay.payments.refund(paymentId, {
    amount: Math.round(Number(amount) * 100),
    speed: "normal",
    notes,
  });
};
