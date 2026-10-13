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
