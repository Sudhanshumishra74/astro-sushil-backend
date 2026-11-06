// ─────────────────────────────────────────────────────────────────────────────
// Email Templates  |  Brand: #424874 primary · #D4AF37 gold · Philosopher font
// ─────────────────────────────────────────────────────────────────────────────

import dotenv from "dotenv";
dotenv.config();

const BRAND = {
  primary: "#424874",
  primaryDark: "#2e3254",
  gold: "#D4AF37",
  goldLight: "#f4eeff",
  secondary: "#d9d6e8",
  bg: "#f4f0fb",
  white: "#ffffff",
  textDark: "#1a1a2e",
  textMuted: "#6b6b8a",
  border: "#e0dcf0",
};

const layout = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:${BRAND.primary};border-radius:16px 16px 0 0;padding:28px 36px;text-align:center;">
              <div style="display:inline-block;border:2px solid ${BRAND.gold};border-radius:50%;width:48px;height:48px;line-height:48px;text-align:center;margin-bottom:10px;">
                <span style="color:${BRAND.gold};font-size:22px;">✦</span>
              </div>
              <h1 style="margin:0;color:${BRAND.gold};font-family:Georgia,serif;font-size:22px;letter-spacing:2px;font-weight:600;">
                Astro Sushil
              </h1>
              <p style="margin:4px 0 0;color:${BRAND.secondary};font-size:11px;letter-spacing:3px;text-transform:uppercase;font-family:Arial,sans-serif;">
                Premium Store
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:${BRAND.white};padding:36px;border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${BRAND.primary};border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;">
              <p style="margin:0;color:${BRAND.secondary};font-size:11px;font-family:Arial,sans-serif;letter-spacing:1px;">
                © ${new Date().getFullYear()} Astro Sushil · All rights reserved
              </p>
              <p style="margin:6px 0 0;color:${BRAND.gold};font-size:10px;font-family:Arial,sans-serif;">
                This is an automated message, please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const divider = `<div style="height:1px;background:linear-gradient(to right,transparent,${BRAND.gold},transparent);margin:24px 0;"></div>`;

const sectionTitle = (text) =>
  `<p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${BRAND.gold};font-weight:700;">${text}</p>`;

// Booking slots are stored as a "HH:mm-HH:mm" range string (see
// availability/generateSlots.js). Only in-person bookings show just the
// start time ("14:00"); audio/video keep the full range as before.
const formatSlotTime = (slot, mode) =>
  slot && mode === "in_person" ? String(slot).split("-")[0] : slot;

// In-person bookings have no video/voice call to join, so they get a single
// coordination-call message instead of the WhatsApp/Botim call instructions.
const callInstructionsHtml = (mode, { rescheduled = false } = {}) => {
  if (mode === "in_person") {
    return `
    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};text-align:center;">
      For meeting coordination, please call this number <strong style="color:${BRAND.primary};">+91 9125000013</strong>.
    </p>
    `;
  }

  const timingPhrase = rescheduled
    ? "on the updated appointment date and time"
    : "on the date and time of your appointment";

  return `
    <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};text-align:center;">
      Please call <strong style="color:${BRAND.primary};">+91 9125000013</strong> ${timingPhrase}.
    </p>
    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};text-align:center;">
      You can also reach us via <strong>WhatsApp</strong> or <strong>Botim ${mode === "video" ? "video" : "voice"} call</strong>.
    </p>
  `;
};

const infoRow = (label, value) => `
  <tr>
    <td style="padding:8px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};width:40%;vertical-align:top;">${label}</td>
    <td style="padding:8px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};font-weight:600;vertical-align:top;">${value}</td>
  </tr>
`;

// A small thumbnail + name combo for a single productRow "name" cell — a
// nested table (not flex/inline-block) since that's what actually renders
// consistently across email clients. Falls back to plain text with no
// image cell at all when there's no image, rather than an empty thumbnail box.
const productNameCell = (name, image) =>
  image
    ? `
  <table cellpadding="0" cellspacing="0"><tr>
    <td width="40" style="vertical-align:middle;padding-right:10px;"><img src="${image}" alt="" width="36" height="36" style="border-radius:6px;display:block;object-fit:cover;"/></td>
    <td style="vertical-align:middle;">${name}</td>
  </tr></table>
`
    : name;

const productRow = (name, qty, price) => `
  <tr>
    <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};border-bottom:1px solid ${BRAND.border};">${name}</td>
    <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};text-align:center;border-bottom:1px solid ${BRAND.border};">${qty ?? "-"}</td>
    <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};font-weight:600;text-align:right;border-bottom:1px solid ${BRAND.border};">${price ?? ""}</td>
  </tr>
`;

const ctaButton = (href, text) => `
  <a href="${href}" style="display:inline-block;margin-top:6px;padding:12px 28px;background:${BRAND.primary};color:${BRAND.gold};text-decoration:none;border-radius:8px;font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;border:1px solid ${BRAND.gold};">
    ${text}
  </a>
`;

const ctaButtonSecondary = (href, text) => `
  <a href="${href}" style="display:inline-block;margin:6px 0 0 10px;padding:12px 28px;background:${BRAND.white};color:${BRAND.primary};text-decoration:none;border-radius:8px;font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;border:1px solid ${BRAND.primary};">
    ${text}
  </a>
`;

// Invoice downloads require an authenticated request (verifyToken reads the
// bearer token from the Authorization header only), so a plain email link
// can't hit the API route directly — it routes users to the dashboard tab
// where they're already signed in and can trigger the download themselves.
const bookingInvoiceLink = () =>
  `${process.env.FRONTEND_URL}/dashboard?tab=consultations`;

// Displayed order/shipment/return IDs must match the short 8-char form used
// everywhere else (admin panel, customer site, invoice/credit-note PDFs) —
// only ever apply this to human-facing text, never to a URL/query-param
// built from the same id (those still need the full ObjectId to resolve).
const shortOrderId = (id) => String(id || "").slice(-8).toUpperCase();

const formatCurrency = (amount, currency = "INR") => {
  const num = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toLocaleString()}`;
  }
};

const ORDER_STATUS_META = {
  placed: {
    icon: "✓",
    heading: "Order Placed!",
    message:
      "your order has been placed successfully. We'll notify you once it ships.",
  },
  pending: {
    icon: "⏳",
    heading: "Order Pending",
    message: "your order has been received and is pending confirmation.",
  },
  confirmed: {
    icon: "✓",
    heading: "Order Confirmed!",
    message: "your order has been confirmed. We'll notify you once it ships.",
  },
  processing: {
    icon: "⚙",
    heading: "Order Processing",
    message: "your order is now being processed.",
  },
  shipped: {
    icon: "🚚",
    heading: "Order Shipped!",
    message: "your order is on its way to you.",
  },
  delivered: {
    icon: "📦",
    heading: "Order Delivered!",
    message: "your order has been delivered. We hope you love it!",
  },
  cancelled: {
    icon: "✕",
    heading: "Order Cancelled",
    message:
      "your order has been cancelled. If you didn't request this, please contact support.",
  },
};

// Covers exactly the shipment statuses that ever reach this template — see
// NOTIFIABLE_STATUSES (shiprocketTracking.service.js), which decides whether
// a "shipment-update" job is even enqueued. Any status outside this set
// never triggers an email, so it's intentionally not an exhaustive map of
// every SHIPROCKET_STATUS_CODES slug.
const SHIPMENT_STATUS_META = {
  picked_up: {
    icon: "📦",
    heading: "Shipment Picked Up",
    message: "your shipment has been picked up by the courier.",
  },
  shipped: {
    icon: "🚚",
    heading: "Order Shipped!",
    message: "your shipment is on its way to you.",
  },
  out_for_delivery: {
    icon: "🚴",
    heading: "Out For Delivery",
    message: "your shipment is out for delivery and should arrive soon.",
  },
  delivered: {
    icon: "✓",
    heading: "Delivered!",
    message: "your shipment has been delivered. We hope you love it!",
  },
  undelivered: {
    icon: "⚠",
    heading: "Delivery Attempt Failed",
    message: "the courier attempted delivery but could not complete it. A re-attempt will be made shortly.",
  },
  rto_initiated: {
    icon: "↩",
    heading: "Return To Origin Initiated",
    message: "your shipment is being sent back to us by the courier.",
  },
  rto_delivered: {
    icon: "↩",
    heading: "Returned To Sender",
    message: "your shipment has been returned to us.",
  },
  cancelled: {
    icon: "✕",
    heading: "Shipment Cancelled",
    message: "your shipment has been cancelled. If you didn't request this, please contact support.",
  },
};
const DEFAULT_SHIPMENT_STATUS_META = {
  icon: "📦",
  heading: "Shipment Update",
  message: "there's an update on your shipment.",
};

// Mirrors the Return.status enum (return.model.js) exactly — every value
// that model allows gets an entry here. Exported so the WhatsApp send in
// notification.worker.js can reuse the same heading/message instead of a
// second copy of this table drifting out of sync with the email one.
export const RETURN_STATUS_META = {
  requested: {
    icon: "↩",
    heading: "Return Requested",
    message: "we've received your return request and will review it shortly.",
  },
  approved: {
    icon: "✓",
    heading: "Return Approved",
    message: "your return has been approved. We'll arrange a pickup shortly.",
  },
  pickup_scheduled: {
    icon: "📅",
    heading: "Pickup Scheduled",
    message: "a pickup has been scheduled for your returned item(s).",
  },
  picked_up: {
    icon: "📦",
    heading: "Return Picked Up",
    message: "your returned item(s) have been picked up by the courier.",
  },
  in_transit: {
    icon: "🚚",
    heading: "Return In Transit",
    message: "your returned item(s) are on their way to our warehouse.",
  },
  received: {
    icon: "📥",
    heading: "Return Received",
    message: "your returned item(s) have reached our warehouse and will be inspected shortly.",
  },
  inspection_pending: {
    icon: "🔍",
    heading: "Return Under Inspection",
    message: "your returned item(s) are currently being inspected.",
  },
  approved_for_refund: {
    icon: "✓",
    heading: "Refund Approved",
    message: "your return passed inspection and a refund is on the way.",
  },
  rejected: {
    icon: "✕",
    heading: "Return Not Approved",
    message: "your return request was not approved. Please contact support if you have questions.",
  },
  refunded: {
    icon: "₹",
    heading: "Refund Processed",
    message: "your refund has been processed.",
  },
};
export const DEFAULT_RETURN_STATUS_META = {
  icon: "↩",
  heading: "Return Update",
  message: "there's an update on your return.",
};

const emailTemplates = {
  OTP: ({ otp }) => ({
    subject: "Your Verification Code — Astro Sushil",
    html: layout(`
      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};">Verify Your Identity</h2>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};">
        Use the code below to complete your verification. Do not share this with anyone.
      </p>

      ${divider}

      <div style="text-align:center;margin:28px 0;">
        <div style="display:inline-block;background:${BRAND.goldLight};border:2px dashed ${BRAND.gold};border-radius:12px;padding:20px 48px;">
          <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;color:${BRAND.textMuted};text-transform:uppercase;">One-Time Password</p>
          <p style="margin:0;font-family:'Courier New',monospace;font-size:38px;font-weight:700;color:${BRAND.primary};letter-spacing:10px;">${otp}</p>
        </div>
      </div>

      ${divider}

      <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:${BRAND.textMuted};text-align:center;">
        ⏱ This code expires in <strong>${process.env.OTP_TTL_MINUTES || 5} minutes</strong>
      </p>
    `),
  }),

  WELCOME: ({ name }) => ({
    subject: `Welcome to Astro Sushil, ${name}! 🎉`,
    html: layout(`
      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:26px;color:${BRAND.primary};">Welcome, ${name}!</h2>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};">
        Your account has been created successfully. We're thrilled to have you.
      </p>

      ${divider}

      <div style="display:flex;gap:16px;margin:24px 0;">
        ${[
          ["✦", "Exclusive Deals", "Members-only offers & early access"],
          ["◈", "Fast Checkout", "Saved addresses & payment methods"],
          ["⊛", "Order Tracking", "Real-time updates on every order"],
        ]
          .map(
            ([icon, title, sub]) => `
          <div style="flex:1;text-align:center;padding:16px 12px;background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};">
            <div style="font-size:20px;color:${BRAND.gold};margin-bottom:6px;">${icon}</div>
            <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:${BRAND.primary};">${title}</p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:${BRAND.textMuted};">${sub}</p>
          </div>
        `,
          )
          .join("")}
      </div>

      ${divider}

      <div style="text-align:center;">
        ${ctaButton(`${process.env.FRONTEND_URL}/products` || "#", "Start Shopping →")}
      </div>
    `),
  }),

  RESET_PASSWORD: ({ link }) => ({
    subject: "Reset Your Password — Astro Sushil",
    html: layout(`
      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};">Password Reset Request</h2>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};">
        We received a request to reset your password. Click the button below to proceed.
        If you didn't request this, you can safely ignore this email.
      </p>

      ${divider}

      <div style="text-align:center;margin:28px 0;">
        ${ctaButton(link, "Reset Password")}
      </div>

      ${divider}

      <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:${BRAND.textMuted};text-align:center;">
        ⏱ This link expires in 30 minutes · If button doesn't work, copy this URL:<br/>
        <a href="${link}" style="color:${BRAND.primary};font-size:10px;word-break:break-all;">${link}</a>
      </p>
    `),
  }),

  CONTACT_ADMIN: ({ name, email, phone, subject, message }) => ({
    subject: `📩 New Contact — ${subject || "General Enquiry"}`,
    html: layout(`
      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};">New Contact Form Submission</h2>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};">
        A user has submitted the contact form. Details below.
      </p>

      ${divider}
      ${sectionTitle("Sender Details")}

      <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">
        ${infoRow("Name", name)}
        ${infoRow("Email", `<a href="mailto:${email}" style="color:${BRAND.primary};">${email}</a>`)}
        ${infoRow("Phone", phone || "—")}
        ${infoRow("Subject", subject || "—")}
      </table>

      ${sectionTitle("Message")}
      <div style="background:${BRAND.white};border:1px solid ${BRAND.border};border-left:3px solid ${BRAND.gold};border-radius:0 8px 8px 0;padding:16px 18px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};line-height:1.7;">
        ${message}
      </div>

      ${divider}

      <div style="text-align:center;">
        ${ctaButton(`mailto:${email}`, "Reply to User →")}
      </div>
    `),
  }),

  CONTACT_USER: ({ name, message }) => ({
    subject: "We've received your message — Astro Sushil",
    html: layout(`
      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};">We got your message, ${name}!</h2>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};">
        Thank you for reaching out to us. Our team has received your query and will get back to you within <strong>24–48 hours</strong>.
      </p>

      ${divider}
      ${sectionTitle("Your Message")}

      <div style="background:${BRAND.goldLight};border:1px solid ${BRAND.border};border-radius:10px;padding:16px 18px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};line-height:1.7;">
        ${message}
      </div>

      ${divider}

      <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};text-align:center;">
        In the meantime, feel free to explore our store.
      </p>
      <div style="text-align:center;margin-top:16px;">
        ${ctaButton(process.env.FRONTEND_URL || "#", "Visit Astro Sushil →")}
      </div>
    `),
  }),

  ORDER_CONFIRMED_USER: ({
    userName,
    orderStatus,
    orderId,
    products = [],
    subTotal,
    discount = 0,
    couponCode,
    totalAmount,
    shipping = 0,
    tax = 0,
    address,
    orderType,
    currency = "INR",
    downloadLink,
  }) => ({
    subject: `Order ${orderStatus} #${shortOrderId(orderId)} — Astro Sushil`,
    html: (() => {
      const statusMeta =
        ORDER_STATUS_META[orderStatus] || ORDER_STATUS_META.placed;
      const isCancelled = orderStatus === "cancelled";
      const isDelivered = orderStatus === "delivered";

      // orderType is "physical" whenever ANY item is physical, even one
      // bought alongside a digital item (see order.model.js) — so it alone
      // can't tell a pure-physical order apart from a mixed one. downloadLink
      // is the reliable signal: the worker only sets it when the order has
      // at least one digital item (handleOrderConfirmed, notification.worker.js).
      const hasDigitalItems = !!downloadLink;
      const isMixedOrder = hasDigitalItems && orderType !== "digital";

      return layout(`
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:${BRAND.goldLight};border:2px solid ${BRAND.gold};border-radius:50%;width:56px;height:56px;line-height:56px;font-size:26px;">${statusMeta.icon}</div>
      </div>

      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};text-align:center;">${statusMeta.heading}</h2>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};text-align:center;">
        Hi <strong>${userName}</strong>, ${statusMeta.message}
      </p>

      ${divider}
      ${sectionTitle("Order Details")}

      <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">
        ${infoRow("Order ID", `<span style="font-family:'Courier New',monospace;color:${BRAND.primary};">#${shortOrderId(orderId)}</span>`)}
        ${infoRow("Total Amount", `<span style="color:${BRAND.primary};font-size:15px;">${formatCurrency(totalAmount, currency)}</span>`)}
        ${address ? infoRow("Deliver To", `${address.addressLine1}, ${address.city}, ${address.state} – ${address.pincode}`) : ""}
      </table>

      ${sectionTitle("Items Ordered")}

      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid ${BRAND.border};margin-bottom:20px;">
        <tr style="background:${BRAND.primary};">
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};">Product</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};text-align:center;">Qty</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};text-align:right;">Price</td>
        </tr>
        ${products
          .map((p) => {
            const typeTag =
              isMixedOrder && p.type
                ? ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background:${p.type === "digital" ? BRAND.gold : BRAND.secondary};color:${BRAND.primary};font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${p.type}</span>`
                : "";
            return productRow(`${p.name}${typeTag}`, p.quantity, p.price ? formatCurrency(p.price, currency) : "");
          })
          .join("")}
        <tr>
          <td colspan="2" style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};border-bottom:1px solid ${BRAND.border};">Subtotal</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};font-weight:600;text-align:right;border-bottom:1px solid ${BRAND.border};">${formatCurrency(subTotal ?? totalAmount, currency)}</td>
        </tr>
        ${
          discount > 0
            ? `
        <tr>
          <td colspan="2" style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:#1e8449;border-bottom:1px solid ${BRAND.border};">Discount${couponCode ? ` (${couponCode})` : ""}</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:#1e8449;font-weight:600;text-align:right;border-bottom:1px solid ${BRAND.border};">− ${formatCurrency(discount, currency)}</td>
        </tr>`
            : ""
        }
        ${
          shipping > 0
            ? `
        <tr>
          <td colspan="2" style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};border-bottom:1px solid ${BRAND.border};">Shipping</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};font-weight:600;text-align:right;border-bottom:1px solid ${BRAND.border};">${formatCurrency(shipping, currency)}</td>
        </tr>`
            : ""
        }
        ${
          tax > 0
            ? `
        <tr>
          <td colspan="2" style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};border-bottom:1px solid ${BRAND.border};">Tax</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};font-weight:600;text-align:right;border-bottom:1px solid ${BRAND.border};">${formatCurrency(tax, currency)}</td>
        </tr>`
            : ""
        }
        <tr style="background:${BRAND.goldLight};">
          <td colspan="2" style="padding:12px;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:${BRAND.primary};">Total</td>
          <td style="padding:12px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:${BRAND.primary};text-align:right;">${formatCurrency(totalAmount, currency)}</td>
        </tr>
      </table>

      ${divider}

      ${
        isCancelled
          ? `
      <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};text-align:center;">
        If a payment was made for this order, any applicable refund will be processed shortly.
      </p>
      `
          : `
      ${
        hasDigitalItems
          ? `
      <div style="background:${BRAND.goldLight};border:1px solid ${BRAND.gold};border-radius:12px;padding:24px 28px;text-align:center;margin:0 0 24px;">
        <div style="font-size:28px;margin-bottom:10px;">⬇️</div>
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:17px;color:${BRAND.primary};font-weight:600;">Your Digital Products Are Ready</p>
        <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};line-height:1.7;">
          ${
            isMixedOrder
              ? "The digital item(s) in this order are ready to download immediately — the physical item(s) will ship separately."
              : "You can download your purchased products immediately from your downloads dashboard."
          }
        </p>
        ${ctaButton(downloadLink || `${process.env.FRONTEND_URL}/dashboard?tab=downloads`, "Download Your Products →")}
      </div>
      `
          : ""
      }
      ${
        orderType !== "digital"
          ? isDelivered
            ? `
      <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};text-align:center;">
        We hope you're happy with your purchase. Thank you for shopping with us!
      </p>
      `
            : `
      <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};text-align:center;">
        Your ${isMixedOrder ? "physical item(s) will be" : "order will be"} dispatched within 5 - 6 working days.
      </p>
      `
          : ""
      }
      `
      }

      <div style="text-align:center;">
        ${ctaButton(`${process.env.FRONTEND_URL}/dashboard?tab=orders`, "View Your Order →")}
      </div>
    `);
    })(),
  }),

  ORDER_UPDATED_ADMIN: ({
    userName,
    userEmail,
    userPhone,
    orderId,
    products = [],
    subTotal,
    discount = 0,
    couponCode,
    totalAmount,
    shipping = 0,
    tax = 0,
    currency = "INR",
    orderStatus,
  }) => {
    const statusMeta =
      ORDER_STATUS_META[orderStatus] || ORDER_STATUS_META.placed;

    const isCancelled = orderStatus === "cancelled";
    const isDelivered = orderStatus === "delivered";

    return {
      subject: `${statusMeta.icon} Order ${statusMeta.heading} #${shortOrderId(orderId)}`,
      html: layout(`
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:${BRAND.goldLight};border:2px solid ${BRAND.gold};border-radius:50%;width:56px;height:56px;line-height:56px;font-size:26px;">
          ${statusMeta.icon}
        </div>
      </div>

      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};text-align:center;">
        ${statusMeta.heading}
      </h2>

      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};text-align:center;">
        Order <strong>#${shortOrderId(orderId)}</strong> has been updated.
      </p>

      ${divider}

      ${sectionTitle("Customer Details")}

      <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">
        ${infoRow("Name", userName)}
        ${infoRow(
          "Email",
          `<a href="mailto:${userEmail}" style="color:${BRAND.primary};">${userEmail}</a>`,
        )}
        ${infoRow("Phone", userPhone || "—")}
        ${infoRow(
          "Order ID",
          `<span style="font-family:'Courier New',monospace;">#${shortOrderId(orderId)}</span>`,
        )}
        ${infoRow(
          "Status",
          `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${BRAND.gold};color:${BRAND.primary};font-weight:700;">
            ${statusMeta.icon} ${statusMeta.heading}
          </span>`,
        )}
        ${infoRow(
          "Total",
          `<span style="color:${BRAND.primary};font-size:15px;font-weight:700;">
            ${formatCurrency(totalAmount, currency)}
          </span>`,
        )}
      </table>

      ${sectionTitle("Items")}

      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid ${BRAND.border};margin-bottom:20px;">
        <tr style="background:${BRAND.primary};">
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};">
            Product
          </td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};text-align:center;">
            Qty
          </td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};text-align:right;">
            Price
          </td>
        </tr>

        ${products
          .map((p) =>
            productRow(
              p.name,
              p.quantity,
              p.price ? formatCurrency(p.price, currency) : "",
            ),
          )
          .join("")}
        <tr>
          <td colspan="2" style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};border-bottom:1px solid ${BRAND.border};">Subtotal</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};font-weight:600;text-align:right;border-bottom:1px solid ${BRAND.border};">${formatCurrency(subTotal ?? totalAmount, currency)}</td>
        </tr>
        ${
          discount > 0
            ? `
        <tr>
          <td colspan="2" style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:#1e8449;border-bottom:1px solid ${BRAND.border};">Discount${couponCode ? ` (${couponCode})` : ""}</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:#1e8449;font-weight:600;text-align:right;border-bottom:1px solid ${BRAND.border};">− ${formatCurrency(discount, currency)}</td>
        </tr>`
            : ""
        }
        ${
          shipping > 0
            ? `
        <tr>
          <td colspan="2" style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};border-bottom:1px solid ${BRAND.border};">Shipping</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};font-weight:600;text-align:right;border-bottom:1px solid ${BRAND.border};">${formatCurrency(shipping, currency)}</td>
        </tr>`
            : ""
        }
        ${
          tax > 0
            ? `
        <tr>
          <td colspan="2" style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};border-bottom:1px solid ${BRAND.border};">Tax</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};font-weight:600;text-align:right;border-bottom:1px solid ${BRAND.border};">${formatCurrency(tax, currency)}</td>
        </tr>`
            : ""
        }
        <tr style="background:${BRAND.goldLight};">
          <td colspan="2" style="padding:12px;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:${BRAND.primary};">Total</td>
          <td style="padding:12px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:${BRAND.primary};text-align:right;">${formatCurrency(totalAmount, currency)}</td>
        </tr>
      </table>

      ${divider}

      ${
        isCancelled
          ? `
      <div style="background:#fff4f4;border:1px solid #e74c3c;border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#c0392b;font-weight:600;">
          This order has been cancelled.
        </p>
      </div>
      `
          : isDelivered
            ? `
      <div style="background:#f4fff7;border:1px solid #27ae60;border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#1e8449;font-weight:600;">
          This order has been successfully delivered.
        </p>
      </div>
      `
            : `
      <div style="background:${BRAND.goldLight};border:1px solid ${BRAND.border};border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textDark};">
          The order status has been updated to
          <strong>${statusMeta.heading}</strong>.
        </p>
      </div>
      `
      }

      <div style="text-align:center;">
        ${ctaButton(`${process.env.ADMIN_URL}/orders`, "View Order →")}
      </div>
    `),
    };
  },

  SHIPMENT_UPDATE_USER: ({
    userName,
    orderId,
    status,
    courier,
    awb,
    trackingUrl,
    items,
    currency,
  }) => {
    const statusMeta = SHIPMENT_STATUS_META[status] || DEFAULT_SHIPMENT_STATUS_META;

    return {
      subject: `${statusMeta.heading} — Order #${shortOrderId(orderId)}`,
      html: layout(`
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:${BRAND.goldLight};border:2px solid ${BRAND.gold};border-radius:50%;width:56px;height:56px;line-height:56px;font-size:26px;">${statusMeta.icon}</div>
      </div>

      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};text-align:center;">${statusMeta.heading}</h2>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};text-align:center;">
        Hi <strong>${userName || "there"}</strong>, ${statusMeta.message}
      </p>

      ${divider}
      ${sectionTitle("Shipment Details")}

      <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">
        ${infoRow("Order ID", `<span style="font-family:'Courier New',monospace;color:${BRAND.primary};">#${shortOrderId(orderId)}</span>`)}
        ${courier ? infoRow("Courier", courier) : ""}
        ${awb ? infoRow("AWB / Tracking No.", `<span style="font-family:'Courier New',monospace;">${awb}</span>`) : ""}
      </table>

      ${
        items?.length
          ? `
      ${sectionTitle("Items in This Shipment")}

      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid ${BRAND.border};margin-bottom:20px;">
        <tr style="background:${BRAND.primary};">
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};">Product</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};text-align:center;">Qty</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};text-align:right;">Price</td>
        </tr>
        ${items
          .map((item) =>
            productRow(
              productNameCell(
                `${item.name}${item.variantLabel ? ` <span style="color:${BRAND.textMuted};font-size:11px;">(${item.variantLabel})</span>` : ""}`,
                item.image,
              ),
              item.quantity,
              item.price != null ? formatCurrency(item.price, currency) : "",
            ),
          )
          .join("")}
      </table>
      `
          : ""
      }

      ${divider}

      <div style="text-align:center;">
        ${trackingUrl ? ctaButton(trackingUrl, "Track Shipment →") : ""}
        ${trackingUrl ? ctaButtonSecondary(`${process.env.FRONTEND_URL}/dashboard?tab=orders`, "View Order →") : ctaButton(`${process.env.FRONTEND_URL}/dashboard?tab=orders`, "View Order →")}
      </div>
    `),
    };
  },

  SHIPMENT_UPDATE_ADMIN: ({
    userName,
    userEmail,
    orderId,
    shipmentId,
    status,
    statusCode,
    courier,
    awb,
    trackingUrl,
    items,
    currency,
  }) => {
    const statusMeta = SHIPMENT_STATUS_META[status] || DEFAULT_SHIPMENT_STATUS_META;
    const isCancelled = status === "cancelled";
    const isDelivered = status === "delivered";

    return {
      subject: `${statusMeta.icon} ${statusMeta.heading} — Order #${shortOrderId(orderId)}`,
      html: layout(`
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:${BRAND.goldLight};border:2px solid ${BRAND.gold};border-radius:50%;width:56px;height:56px;line-height:56px;font-size:26px;">${statusMeta.icon}</div>
      </div>

      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};text-align:center;">${statusMeta.heading}</h2>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};text-align:center;">
        The shipment for order <strong>#${shortOrderId(orderId)}</strong> has been updated.
      </p>

      ${divider}
      ${sectionTitle("Customer Details")}

      <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">
        ${infoRow("Name", userName || "—")}
        ${infoRow("Email", userEmail ? `<a href="mailto:${userEmail}" style="color:${BRAND.primary};">${userEmail}</a>` : "—")}
        ${infoRow("Order ID", `<span style="font-family:'Courier New',monospace;">#${shortOrderId(orderId)}</span>`)}
      </table>

      ${sectionTitle("Shipment Details")}

      <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">
        ${infoRow("Shipment ID", `<span style="font-family:'Courier New',monospace;">${shipmentId}</span>`)}
        ${infoRow("Status", `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${BRAND.gold};color:${BRAND.primary};font-weight:700;">${statusMeta.icon} ${statusMeta.heading}</span>`)}
        ${statusCode != null ? infoRow("Status Code", statusCode) : ""}
        ${courier ? infoRow("Courier", courier) : ""}
        ${awb ? infoRow("AWB", `<span style="font-family:'Courier New',monospace;">${awb}</span>`) : ""}
        ${trackingUrl ? infoRow("Tracking", `<a href="${trackingUrl}" style="color:${BRAND.primary};">${trackingUrl}</a>`) : ""}
      </table>

      ${
        items?.length
          ? `
      ${sectionTitle("Items in This Shipment")}

      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid ${BRAND.border};margin-bottom:20px;">
        <tr style="background:${BRAND.primary};">
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};">Product</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};text-align:center;">Qty</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};text-align:right;">Price</td>
        </tr>
        ${items
          .map((item) =>
            productRow(
              productNameCell(
                `${item.name}${item.variantLabel ? ` <span style="color:${BRAND.textMuted};font-size:11px;">(${item.variantLabel})</span>` : ""}`,
                item.image,
              ),
              item.quantity,
              item.price != null ? formatCurrency(item.price, currency) : "",
            ),
          )
          .join("")}
      </table>
      `
          : ""
      }

      ${divider}

      ${
        isCancelled
          ? `
      <div style="background:#fff4f4;border:1px solid #e74c3c;border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#c0392b;font-weight:600;">This shipment has been cancelled.</p>
      </div>
      `
          : isDelivered
            ? `
      <div style="background:#f4fff7;border:1px solid #27ae60;border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#1e8449;font-weight:600;">This shipment has been successfully delivered.</p>
      </div>
      `
            : `
      <div style="background:${BRAND.goldLight};border:1px solid ${BRAND.border};border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textDark};">The shipment status has been updated to <strong>${statusMeta.heading}</strong>.</p>
      </div>
      `
      }

      <div style="text-align:center;">
        ${ctaButton(`${process.env.ADMIN_URL}/orders/${orderId}?tab=shipments`, "View Shipment →")}
      </div>
    `),
    };
  },

  RETURN_STATUS_UPDATE_USER: ({
    userName,
    orderId,
    returnId,
    status,
    courier,
    awb,
    trackingUrl,
    refundAmount,
    refundIncludesShipping,
    refundMethod,
    shippingAmount,
    currency = "INR",
    reason,
    adminNote,
    items,
  }) => {
    const statusMeta = RETURN_STATUS_META[status] || DEFAULT_RETURN_STATUS_META;

    const itemsTableHTML = items?.length
      ? `
      ${sectionTitle("Items In This Return")}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid ${BRAND.border};margin-bottom:20px;">
        <tr style="background:${BRAND.primary};">
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};">Product</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};text-align:center;">Qty</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};text-align:right;">Price</td>
        </tr>
        ${items.map((p) => productRow(p.name, p.quantity, p.price != null ? formatCurrency(p.price, currency) : "")).join("")}
      </table>
      `
      : "";

    const refundTableHTML =
      refundAmount != null
        ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid ${BRAND.border};margin-bottom:20px;">
        <tr style="background:${BRAND.goldLight};">
          <td style="padding:12px;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:${BRAND.primary};">Refund Amount</td>
          <td style="padding:12px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:${BRAND.primary};text-align:right;">${formatCurrency(refundAmount, currency)}</td>
        </tr>
        ${
          refundIncludesShipping
            ? `
        <tr>
          <td colspan="2" style="padding:8px 12px;font-family:Arial,sans-serif;font-size:12px;color:${BRAND.textMuted};border-top:1px solid ${BRAND.border};">
            Includes ${formatCurrency(shippingAmount, currency)} shipping — every item on this order has now been returned.
          </td>
        </tr>`
            : ""
        }
        ${
          refundMethod
            ? `
        <tr>
          <td style="padding:8px 12px;font-family:Arial,sans-serif;font-size:12px;color:${BRAND.textMuted};border-top:1px solid ${BRAND.border};">Refunded Via</td>
          <td style="padding:8px 12px;font-family:Arial,sans-serif;font-size:12px;color:${BRAND.textDark};text-align:right;border-top:1px solid ${BRAND.border};">${refundMethod === "razorpay" ? "Razorpay" : "Bank transfer / cash (recorded manually)"}</td>
        </tr>`
            : ""
        }
      </table>
      `
        : "";

    return {
      subject: `${statusMeta.heading} — Order #${shortOrderId(orderId)}`,
      html: layout(`
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:${BRAND.goldLight};border:2px solid ${BRAND.gold};border-radius:50%;width:56px;height:56px;line-height:56px;font-size:26px;">${statusMeta.icon}</div>
      </div>

      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};text-align:center;">${statusMeta.heading}</h2>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};text-align:center;">
        Hi <strong>${userName || "there"}</strong>, ${statusMeta.message}
      </p>

      ${divider}
      ${sectionTitle("Return Details")}

      <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">
        ${infoRow("Order ID", `<span style="font-family:'Courier New',monospace;color:${BRAND.primary};">#${shortOrderId(orderId)}</span>`)}
        ${infoRow("Return ID", `<span style="font-family:'Courier New',monospace;">#${returnId}</span>`)}
        ${reason ? infoRow("Reason", reason) : ""}
        ${courier ? infoRow("Courier", courier) : ""}
        ${awb ? infoRow("AWB / Tracking No.", `<span style="font-family:'Courier New',monospace;">${awb}</span>`) : ""}
      </table>

      ${itemsTableHTML}
      ${refundTableHTML}

      ${
        status === "rejected" && adminNote
          ? `
      <div style="background:#fff4f4;border:1px solid #e74c3c;border-radius:10px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;color:#c0392b;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Why this wasn't approved</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textDark};">${adminNote}</p>
      </div>
      `
          : ""
      }

      ${divider}

      <div style="text-align:center;">
        ${trackingUrl ? ctaButton(trackingUrl, "Track Return →") : ""}
        ${trackingUrl ? ctaButtonSecondary(`${process.env.FRONTEND_URL}/dashboard?tab=orders`, "View Order →") : ctaButton(`${process.env.FRONTEND_URL}/dashboard?tab=orders`, "View Order →")}
      </div>
    `),
    };
  },

  RETURN_STATUS_UPDATE_ADMIN: ({
    userName,
    userEmail,
    orderId,
    returnId,
    status,
    courier,
    awb,
    trackingUrl,
    refundAmount,
    refundIncludesShipping,
    razorpayRefundId,
    refundMethod,
    shippingAmount,
    currency = "INR",
    reason,
    adminNote,
    error,
    items,
  }) => {
    const statusMeta = RETURN_STATUS_META[status] || DEFAULT_RETURN_STATUS_META;
    const isRejected = status === "rejected";
    const isRefunded = status === "refunded" || status === "approved_for_refund";

    const itemsTableHTML = items?.length
      ? `
      ${sectionTitle("Items In This Return")}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid ${BRAND.border};margin-bottom:20px;">
        <tr style="background:${BRAND.primary};">
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};">Product</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};text-align:center;">Qty</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};text-align:right;">Price</td>
        </tr>
        ${items.map((p) => productRow(p.name, p.quantity, p.price != null ? formatCurrency(p.price, currency) : "")).join("")}
      </table>
      `
      : "";

    return {
      subject: `${error ? "⚠️ ACTION NEEDED: " : ""}${statusMeta.icon} ${statusMeta.heading} — Order #${shortOrderId(orderId)}`,
      html: layout(`
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:${BRAND.goldLight};border:2px solid ${BRAND.gold};border-radius:50%;width:56px;height:56px;line-height:56px;font-size:26px;">${statusMeta.icon}</div>
      </div>

      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};text-align:center;">${statusMeta.heading}</h2>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};text-align:center;">
        The return for order <strong>#${shortOrderId(orderId)}</strong> has been updated.
      </p>

      ${divider}
      ${sectionTitle("Customer Details")}

      <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">
        ${infoRow("Name", userName || "—")}
        ${infoRow("Email", userEmail ? `<a href="mailto:${userEmail}" style="color:${BRAND.primary};">${userEmail}</a>` : "—")}
        ${infoRow("Order ID", `<span style="font-family:'Courier New',monospace;">#${shortOrderId(orderId)}</span>`)}
      </table>

      ${sectionTitle("Return Details")}

      <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">
        ${infoRow("Return ID", `<span style="font-family:'Courier New',monospace;">${returnId}</span>`)}
        ${infoRow("Status", `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${BRAND.gold};color:${BRAND.primary};font-weight:700;">${statusMeta.icon} ${statusMeta.heading}</span>`)}
        ${reason ? infoRow("Customer's Reason", reason) : ""}
        ${courier ? infoRow("Courier", courier) : ""}
        ${awb ? infoRow("AWB", `<span style="font-family:'Courier New',monospace;">${awb}</span>`) : ""}
        ${trackingUrl ? infoRow("Tracking", `<a href="${trackingUrl}" style="color:${BRAND.primary};">${trackingUrl}</a>`) : ""}
        ${refundAmount != null ? infoRow("Refund Amount", `<span style="color:${BRAND.primary};font-size:15px;font-weight:700;">${formatCurrency(refundAmount, currency)}${refundIncludesShipping ? ` (incl. ${formatCurrency(shippingAmount, currency)} shipping)` : ""}</span>`) : ""}
        ${razorpayRefundId ? infoRow("Refund ID", `<span style="font-family:'Courier New',monospace;">${razorpayRefundId}</span>`) : ""}
        ${refundMethod ? infoRow("Refunded Via", refundMethod === "razorpay" ? "Razorpay" : "Manual (COD order)") : ""}
        ${adminNote ? infoRow("Admin Note", adminNote) : ""}
        ${error ? infoRow("⚠ Error", `<span style="color:#c0392b;font-weight:700;">${error}</span>`) : ""}
      </table>

      ${itemsTableHTML}

      ${divider}

      ${
        isRejected
          ? `
      <div style="background:#fff4f4;border:1px solid #e74c3c;border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#c0392b;font-weight:600;">This return was not approved.</p>
      </div>
      `
          : isRefunded
            ? `
      <div style="background:#f4fff7;border:1px solid #27ae60;border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#1e8449;font-weight:600;">${status === "refunded" ? "The refund has been processed." : "This return passed inspection and is approved for refund."}</p>
      </div>
      `
            : `
      <div style="background:${BRAND.goldLight};border:1px solid ${BRAND.border};border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textDark};">The return status has been updated to <strong>${statusMeta.heading}</strong>.</p>
      </div>
      `
      }

      <div style="text-align:center;">
        ${ctaButton(`${process.env.ADMIN_URL}/orders/${orderId}?tab=returns`, "View Return →")}
      </div>
    `),
    };
  },

  BOOKING_CONFIRMED_USER: ({
    userName,
    bookingId,
    consultationTitle,
    includes = [],
    mode,
    date,
    slot,
    amount,
    currency = "INR",
  }) => ({
    subject: `Booking Confirmed #${bookingId} — Astro Sushil`,
    html: layout(`
   

    <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};text-align:center;">Booking Confirmed!</h2>
    <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};text-align:center;">
      Hi <strong>${userName}</strong>, your session has been booked successfully. We look forward to connecting with you.
    </p>

    ${divider}
    ${sectionTitle("Booking Details")}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">
      ${infoRow("Booking ID", `<span style="font-family:'Courier New',monospace;color:${BRAND.primary};">#${bookingId}</span>`)}
      ${infoRow("Consultation", consultationTitle)}
      ${infoRow("Mode", mode)}
      ${infoRow("Date", date)}
      ${infoRow("Time", formatSlotTime(slot, mode))}
      ${amount ? infoRow("Amount", `<span style="color:${BRAND.primary};font-size:15px;">${formatCurrency(amount, currency)}</span>`) : ""}
    </table>

    ${
      includes.length > 0
        ? `
      ${sectionTitle("What's Included")}
      <ul style="margin:0 0 20px;padding:0 0 0 20px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};line-height:2;">
        ${includes.map((item) => `<li style="margin-bottom:4px;">${item}</li>`).join("")}
      </ul>
    `
        : ""
    }

    ${divider}

   ${callInstructionsHtml(mode)}

    <div style="text-align:center;">
      ${ctaButton(bookingInvoiceLink(), "View My Booking →")}
      ${ctaButtonSecondary(bookingInvoiceLink(), "Download Invoice →")}
    </div>
  `),
  }),

  BOOKING_UPGRADED_USER: ({
    userName,
    bookingId,
    consultationTitle,
    includes = [],
    mode,
    date,
    slot,
    amount,
    currency = "INR",
  }) => ({
    subject: `Booking Updated #${bookingId} — Astro Sushil`,
    html: layout(`

    <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};text-align:center;">
      Booking Updated!
    </h2>

    <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};text-align:center;">
      Hi <strong>${userName}</strong>, your booking has been updated successfully. Your latest session details are below.
    </p>

    ${divider}
    ${sectionTitle("Booking Details")}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">
      ${infoRow("Booking ID", `<span style="font-family:'Courier New',monospace;color:${BRAND.primary};">#${bookingId}</span>`)}
      ${infoRow("Consultation", consultationTitle)}
      ${infoRow("Mode", mode)}
      ${infoRow("Date", date)}
      ${infoRow("Time", formatSlotTime(slot, mode))}
      ${
        amount
          ? infoRow(
              "Amount",
              `<span style="color:${BRAND.primary};font-size:15px;">${formatCurrency(amount, currency)}</span>`,
            )
          : ""
      }
    </table>

    ${
      includes.length > 0
        ? `
      ${sectionTitle("What's Included")}
      <ul style="margin:0 0 20px;padding:0 0 0 20px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};line-height:2;">
        ${includes
          .map((item) => `<li style="margin-bottom:4px;">${item}</li>`)
          .join("")}
      </ul>
    `
        : ""
    }

    ${divider}

    ${callInstructionsHtml(mode)}

    <div style="text-align:center;">
      ${ctaButton(bookingInvoiceLink(), "View Updated Booking →")}
      ${ctaButtonSecondary(bookingInvoiceLink(), "Download Invoice →")}
    </div>
  `),
  }),

  BOOKING_REMINDER_USER: ({
    userName,
    bookingId,
    consultationTitle,
    mode,
    date,
    slot,
  }) => ({
    subject: `Reminder: Consultation Tomorrow — #${bookingId}`,
    html: layout(`
      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};text-align:center;">
        Consultation Reminder
      </h2>

      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};text-align:center;">
        Hi <strong>${userName}</strong>, this is a reminder for your consultation scheduled for tomorrow.
      </p>

      ${divider}
      ${sectionTitle("Consultation Details")}

      <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">
        ${infoRow("Booking ID", `<span style="font-family:'Courier New',monospace;color:${BRAND.primary};">#${bookingId}</span>`)}
        ${infoRow("Consultation", consultationTitle)}
        ${infoRow("Mode", mode)}
        ${infoRow("Date", date)}
        ${infoRow("Time", formatSlotTime(slot, mode))}
      </table>

      ${divider}

      <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};text-align:center;">
        Please be ready at least 5 minutes before the scheduled time.
      </p>
      <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};text-align:center;">
        If you need to reschedule, please contact us on WhatsApp or through your booking dashboard.
      </p>

      <div style="text-align:center;">
        ${ctaButton(bookingInvoiceLink(), "View My Booking →")}
        ${ctaButtonSecondary(bookingInvoiceLink(), "Download Invoice →")}
      </div>
    `),
  }),

  BOOKING_RESCHEDULE_USER: ({
    userName,
    bookingId,
    consultationTitle,
    oldDate,
    oldSlot,
    newDate,
    newSlot,
    mode,
    amount,
    currency = "INR",
  }) => ({
    subject: `Booking Rescheduled #${bookingId} — Astro Sushil`,
    html: layout(`

    <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};text-align:center;">
      Booking Rescheduled
    </h2>

    <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};text-align:center;">
      Hi <strong>${userName}</strong>, your consultation session has been successfully rescheduled.
    </p>

    ${divider}

    ${sectionTitle("Updated Booking Details")}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">

      ${infoRow(
        "Booking ID",
        `<span style="font-family:'Courier New',monospace;color:${BRAND.primary};">#${bookingId}</span>`,
      )}

      ${infoRow("Consultation", consultationTitle)}

      ${infoRow("Mode", mode)}

      ${infoRow(
        "Previous Schedule",
        `<span style="color:${BRAND.textMuted};">${oldDate} • ${formatSlotTime(oldSlot, mode)}</span>`,
      )}

      ${infoRow(
        "New Schedule",
        `<span style="color:${BRAND.primary};font-weight:600;">${newDate} • ${formatSlotTime(newSlot, mode)}</span>`,
      )}

      ${
        amount
          ? infoRow(
              "Amount",
              `<span style="color:${BRAND.primary};font-size:15px;">${formatCurrency(amount, currency)}</span>`,
            )
          : ""
      }

    </table>

    ${divider}

    ${callInstructionsHtml(mode, { rescheduled: true })}

    <div style="text-align:center;">
      ${ctaButton(bookingInvoiceLink(), "View Updated Booking →")}
      ${ctaButtonSecondary(bookingInvoiceLink(), "Download Invoice →")}
    </div>

  `),
  }),

  BOOKING_CONFIRMED_ADMIN: ({
    userName,
    userEmail,
    userPhone,
    bookingId,
    consultationTitle,
    includes = [],
    mode,
    date,
    slot,
    amount,
    currency = "INR",
  }) => ({
    subject: `📅 New Booking #${bookingId} — ${consultationTitle}`,
    html: layout(`
    <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};">New Booking Received</h2>
    <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};">
      A new consultation session has been booked. Review the details below.
    </p>

    ${divider}
    ${sectionTitle("Customer Details")}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">
      ${infoRow("Name", userName)}
      ${infoRow("Email", `<a href="mailto:${userEmail}" style="color:${BRAND.primary};">${userEmail}</a>`)}
      ${infoRow("Phone", userPhone || "—")}
      ${infoRow("Booking ID", `<span style="font-family:'Courier New',monospace;">#${bookingId}</span>`)}
    </table>

    ${sectionTitle("Session Details")}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">
      ${infoRow("Consultation", consultationTitle)}
      ${infoRow("Mode", mode)}
      ${infoRow("Date", date)}
      ${infoRow("Time", formatSlotTime(slot, mode))}
      ${amount ? infoRow("Amount", `<span style="color:${BRAND.primary};font-size:15px;font-weight:700;">${formatCurrency(amount, currency)}</span>`) : ""}
    </table>

    ${
      includes.length > 0
        ? `
      ${sectionTitle("Includes")}
      <ul style="margin:0 0 20px;padding:0 0 0 20px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};line-height:2;">
        ${includes.map((item) => `<li style="margin-bottom:4px;">${item}</li>`).join("")}
      </ul>
    `
        : ""
    }

    ${divider}

    <div style="text-align:center;">
      ${ctaButton(`${process.env.ADMIN_URL}/booking`, "View in Dashboard →")}
    </div>
  `),
  }),

  BOOKING_RESCHEDULE_ADMIN: ({
    userName,
    userEmail,
    userPhone,
    bookingId,
    consultationTitle,
    mode,
    oldDate,
    oldSlot,
    newDate,
    newSlot,
    amount,
    currency = "INR",
  }) => ({
    subject: `📅 Booking Rescheduled #${bookingId} — ${consultationTitle}`,

    html: layout(`

    <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};">
      Booking Rescheduled
    </h2>

    <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};">
      A consultation session has been rescheduled. Updated details are provided below.
    </p>

    ${divider}

    ${sectionTitle("Customer Details")}

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">

      ${infoRow("Name", userName)}

      ${infoRow(
        "Email",
        `<a href="mailto:${userEmail}" style="color:${BRAND.primary};">${userEmail}</a>`,
      )}

      ${infoRow("Phone", userPhone || "—")}

      ${infoRow(
        "Booking ID",
        `<span style="font-family:'Courier New',monospace;">#${bookingId}</span>`,
      )}

    </table>

    ${sectionTitle("Updated Session Details")}

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:${BRAND.goldLight};border-radius:10px;border:1px solid ${BRAND.border};margin-bottom:20px;">

      ${infoRow("Consultation", consultationTitle)}

      ${infoRow("Mode", mode)}

      ${infoRow(
        "Previous Schedule",
        `<span style="color:${BRAND.textMuted};">${oldDate} • ${formatSlotTime(oldSlot, mode)}</span>`,
      )}

      ${infoRow(
        "New Schedule",
        `<span style="color:${BRAND.primary};font-weight:700;">${newDate} • ${formatSlotTime(newSlot, mode)}</span>`,
      )}

      ${
        amount
          ? infoRow(
              "Amount",
              `<span style="color:${BRAND.primary};font-size:15px;font-weight:700;">${formatCurrency(amount, currency)}</span>`,
            )
          : ""
      }

    </table>

    ${divider}

    <div style="text-align:center;">
      ${ctaButton(`${process.env.ADMIN_URL}/booking`, "View Updated Booking →")}
    </div>
  `),
  }),

  REPORT_ORDER_CONFIRMED_USER: ({ userName, reportName }) => ({
    subject: `Your ${reportName} is Being Prepared — Astro Sushil`,
    html: layout(`
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:${BRAND.goldLight};border:2px solid ${BRAND.gold};border-radius:50%;width:56px;height:56px;line-height:56px;font-size:26px;">🙏</div>
      </div>

      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};text-align:center;">
        Thank You for Your Purchase!
      </h2>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};text-align:center;">
        Hello <strong>${userName}</strong>, we have successfully received your request.
      </p>

      ${divider}

      <div style="background:${BRAND.goldLight};border:1px solid ${BRAND.border};border-radius:12px;padding:24px 28px;text-align:center;margin:0 0 24px;">
        <p style="margin:0 0 10px;font-family:Georgia,serif;font-size:18px;color:${BRAND.primary};font-weight:600;">
          ${reportName}
        </p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};line-height:1.7;">
          Your detailed report is currently being prepared and will be<br/>
          delivered to you within the next <strong style="color:${BRAND.primary};">48 hours</strong>.
        </p>
      </div>

      ${divider}

      <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};text-align:center;line-height:1.8;">
        If you have any questions in the meantime, feel free to reach out to us.<br/>
        We appreciate your trust! ✨
      </p>

      <div style="text-align:center;">
        ${ctaButton(`${process.env.FRONTEND_URL}/dashboard?tab=reports`, "View My Orders →")}
      </div>
    `),
  }),

  REPORT_READY_USER: ({ name, reportName, reportUrl }) => ({
    subject: `${reportName} — Your Report is Ready 🎯`,
    html: layout(`
      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};">Your report is ready, ${name}!</h2>
      <p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};">Thanks for ordering. Your ${reportName} has been generated and is ready to download below.</p>

      ${divider}

      ${sectionTitle("Report")}

      <div style="background:${BRAND.goldLight};border:1px solid ${BRAND.border};border-radius:10px;padding:18px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};">
        <p style="margin:0 0 8px;"><strong>${reportName}</strong></p>
        <p style="margin:0 0 12px;color:${BRAND.textMuted};">Click the button below to download your report. The link will remain active for a limited time.</p>
        <div style="text-align:center;margin-top:8px;">
          ${ctaButton(reportUrl, "Download Report")}
        </div>
      </div>

      ${divider}

      <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:${BRAND.textMuted};text-align:center;">If you didn't request this, please contact support.</p>
    `),
  }),

  ABANDONED_CART_USER: ({ name, items = [], cartTotal, currency = "INR" }) => ({
    subject: "You left something behind — Astro Sushil",
    html: layout(`
      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};">Still thinking it over, ${name}?</h2>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};">
        You left ${items.length === 1 ? "an item" : "some items"} in your cart. They're still saved and ready whenever you are.
      </p>

      ${divider}
      ${sectionTitle("Your Cart")}

      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid ${BRAND.border};margin-bottom:20px;">
        <tr style="background:${BRAND.primary};">
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};">Product</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};text-align:center;">Qty</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};text-align:right;">Price</td>
        </tr>
        ${items.map((i) => productRow(i.name, i.quantity, i.price ? formatCurrency(i.price, currency) : "")).join("")}
        <tr>
          <td colspan="2" style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};">Estimated Total</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};font-weight:600;text-align:right;">${formatCurrency(cartTotal, currency)}</td>
        </tr>
      </table>

      <div style="text-align:center;">
        ${ctaButton(`${process.env.FRONTEND_URL}/cart`, "Return To My Cart →")}
      </div>

      ${divider}

      <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:${BRAND.textMuted};text-align:center;">Prices and stock aren't reserved — items may sell out or change price before checkout.</p>
    `),
  }),

  RECOMMENDED_PRODUCTS_USER: ({ name, consultationTitle, items = [] }) => ({
    subject: "Personal Recommendations From Your Consultation — Astro Sushil",
    html: layout(`
      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};">A few things for you, ${name}</h2>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};">
        Based on your${consultationTitle ? ` <strong>${consultationTitle}</strong>` : ""} consultation, our astrologer has personally recommended the following for you.
      </p>

      ${divider}

      ${items
        .map(
          (item) => `
      <div style="background:${BRAND.goldLight};border:1px solid ${BRAND.border};border-radius:10px;padding:16px 18px;margin-bottom:14px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${item.image ? `<td width="64" style="vertical-align:top;padding-right:14px;"><img src="${item.image}" alt="${item.name || ""}" width="64" style="border-radius:8px;display:block;"/></td>` : ""}
            <td style="vertical-align:top;">
              <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:15px;color:${BRAND.primary};font-weight:600;">${item.name || "Recommended Product"}</p>
              ${item.note ? `<p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:12px;color:${BRAND.textMuted};font-style:italic;">"${item.note}"</p>` : ""}
              ${item.slug ? ctaButton(`${process.env.FRONTEND_URL}/product/${item.slug}`, "View Product →") : ""}
            </td>
          </tr>
        </table>
      </div>`,
        )
        .join("")}

      ${divider}

      <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:${BRAND.textMuted};text-align:center;">These are personal suggestions from your consultation, not a guarantee of price or availability.</p>
    `),
  }),

  LOW_STOCK_ADMIN: ({ items = [], threshold }) => ({
    subject: `⚠️ Low Stock Alert — ${items.length} item${items.length === 1 ? "" : "s"} at or below ${threshold}`,
    html: layout(`
      <h2 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;color:${BRAND.primary};">Low Stock Alert</h2>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:${BRAND.textMuted};">
        The following ${items.length === 1 ? "item is" : "items are"} at or below the configured low-stock threshold of <strong>${threshold}</strong> unit${threshold === 1 ? "" : "s"}.
      </p>

      ${divider}

      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid ${BRAND.border};margin-bottom:20px;">
        <tr style="background:${BRAND.primary};">
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};">Product</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};text-align:right;">Stock Left</td>
        </tr>
        ${items
          .map(
            (item) => `
        <tr>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};border-bottom:1px solid ${BRAND.border};">
            ${item.name}${item.variantLabel ? ` <span style="color:${BRAND.textMuted};font-size:11px;">(${item.variantLabel})</span>` : ""}
            ${item.sku ? `<br/><span style="color:${BRAND.textMuted};font-size:11px;">SKU: ${item.sku}</span>` : ""}
          </td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:#c0392b;font-weight:700;text-align:right;border-bottom:1px solid ${BRAND.border};">${item.stock}</td>
        </tr>
        `,
          )
          .join("")}
      </table>

      ${divider}

      <div style="text-align:center;">
        ${ctaButton(`${process.env.ADMIN_URL}/products`, "Manage Products →")}
      </div>
    `),
  }),
};

export { emailTemplates };
