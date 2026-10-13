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
    totalAmount,
    shipping = 0,
    address,
    orderType,
    currency = "INR",
    downloadLink,
  }) => ({
    subject: `Order ${orderStatus} #${orderId} — Astro Sushil`,
    html: (() => {
      const statusMeta =
        ORDER_STATUS_META[orderStatus] || ORDER_STATUS_META.placed;
      const isCancelled = orderStatus === "cancelled";
      const isDelivered = orderStatus === "delivered";

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
        ${infoRow("Order ID", `<span style="font-family:'Courier New',monospace;color:${BRAND.primary};">#${orderId}</span>`)}
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
        ${products.map((p) => productRow(p.name, p.quantity, p.price ? formatCurrency(p.price, currency) : "")).join("")}
        <tr>
          <td colspan="2" style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};border-bottom:1px solid ${BRAND.border};">Subtotal</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};font-weight:600;text-align:right;border-bottom:1px solid ${BRAND.border};">${formatCurrency(subTotal ?? totalAmount, currency)}</td>
        </tr>
        ${
          shipping > 0
            ? `
        <tr>
          <td colspan="2" style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};border-bottom:1px solid ${BRAND.border};">Shipping</td>
          <td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};font-weight:600;text-align:right;border-bottom:1px solid ${BRAND.border};">${formatCurrency(shipping, currency)}</td>
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
          : orderType === "digital"
            ? `
      <div style="background:${BRAND.goldLight};border:1px solid ${BRAND.gold};border-radius:12px;padding:24px 28px;text-align:center;margin:0 0 24px;">
        <div style="font-size:28px;margin-bottom:10px;">⬇️</div>
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:17px;color:${BRAND.primary};font-weight:600;">Your Digital Products Are Ready</p>
        <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};line-height:1.7;">
          You can download your purchased products immediately from your downloads dashboard.
        </p>
        ${ctaButton(downloadLink || `${process.env.FRONTEND_URL}/dashboard?tab=downloads`, "Download Your Products →")}
      </div>
      `
            : isDelivered
              ? `
      <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};text-align:center;">
        We hope you're happy with your purchase. Thank you for shopping with us!
      </p>
      `
              : `
      <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;color:${BRAND.textDark};text-align:center;">
        Your order will be dispatched within 5 - 6 working days.
      </p>
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
    totalAmount,
    currency = "INR",
    orderStatus,
  }) => {
    const statusMeta =
      ORDER_STATUS_META[orderStatus] || ORDER_STATUS_META.placed;

    const isCancelled = orderStatus === "cancelled";
    const isDelivered = orderStatus === "delivered";

    return {
      subject: `${statusMeta.icon} Order ${statusMeta.heading} #${orderId}`,
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
        Order <strong>#${orderId}</strong> has been updated.
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
          `<span style="font-family:'Courier New',monospace;">#${orderId}</span>`,
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
};

export { emailTemplates };
