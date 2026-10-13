import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    branding: {
      siteName: { type: String, default: "My Ecommerce Store" },
      logoUrl: { type: String, default: "" },
      faviconUrl: { type: String, default: "" },
    },

    contact: {
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      whatsapp: { type: String, default: "" },
      address: { type: String, default: "" },
    },

    socialLinks: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
      youtube: { type: String, default: "" },
      linkedin: { type: String, default: "" },
    },

    business: {
      companyName: { type: String, default: "" },
      gstNumber: { type: String, default: "" },
      panNumber: { type: String, default: "" },
    },

    payment: {
      currency: { type: String, default: "INR" },
      taxPercent: { type: Number, default: 0 },
      codEnabled: { type: Boolean, default: true },
      razorpayKey: { type: String, default: "" },
      razorpaySecret: { type: String, default: "" },
      stripeKey: { type: String, default: "" },
      stripeSecret: { type: String, default: "" },
    },

    shipping: {
      freeShippingThreshold: { type: Number, default: 1000 },
      baseDeliveryCharge: { type: Number, default: 50 },
      deliveryChargePerKM: { type: Number, default: 5 },
      maxCODLimit: { type: Number, default: 20000 },
      supportedAreas: { type: [String], default: [] },
    },

    product: {
      lowStockWarning: { type: Number, default: 5 },
      maxQuantityInCart: { type: Number, default: 10 },
    },

    offers: {
      referralRewardPercent: { type: Number, default: 0 },
      enableCoupons: { type: Boolean, default: true },
      flashSaleEnabled: { type: Boolean, default: false },
    },

    order: {
      autoCancelUnpaidMinutes: { type: Number, default: 60 },
      returnPolicyDays: { type: Number, default: 7 },
      maxOrderValue: { type: Number, default: 100000 },
    },

    communication: {
      enableOrderEmails: { type: Boolean, default: true },
      enableOrderSMS: { type: Boolean, default: true },
      enablePushNotifications: { type: Boolean, default: false },
    },

    smtp: {
      host: { type: String, default: "" },
      port: { type: Number, default: 587 },
      secure: { type: Boolean, default: false },
      username: { type: String, default: "" },
      password: { type: String, default: "" },
      fromEmail: { type: String, default: "" },
    },

    sms: {
      provider: { type: String, default: "" },
      apiKey: { type: String, default: "" },
      senderId: { type: String, default: "" },
    },

    otp: {
      expiryMinutes: { type: Number, default: 5 },
      resendTimeoutSec: { type: Number, default: 30 },
    },

    system: {
      maintenanceMode: { type: Boolean, default: false },
    },

    topBar: {
      enabled: { type: Boolean, default: true },
      text: {
        type: String,
        default: "✨ Astro Sushil in Mumbai | 25th, 26th & 27th September 2026 ✨",
      },
      bgColor: { type: String, default: "#ffffff" },
      textColor: { type: String, default: "#ef4444" },
      linkEnabled: { type: Boolean, default: false },
      linkUrl: { type: String, default: "" },
    },

    highlightsBar: {
      enabled: { type: Boolean, default: false },
      text: { type: String, default: "" },
      bgColor: { type: String, default: "#121045" },
      textColor: { type: String, default: "#ffffff" },
      linkEnabled: { type: Boolean, default: false },
      linkUrl: { type: String, default: "" },
    },

    legal: {
      privacyPolicy: { type: String, default: "" },
      termsConditions: { type: String, default: "" },
      returnPolicyText: { type: String, default: "" },
      cancellationRefundPolicy: { type: String, default: "" },
      shippingDeliveryPolicy: { type: String, default: "" },
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true },
);

const Setting = mongoose.model("Setting", settingSchema);
export default Setting;
