const fmt = (amount) =>
  `₹${Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const SUPPLIER_GSTIN = "09ABFCA5917P1Z2";
// Booking records don't capture the customer's state, so place of supply
// defaults to the supplier's own state per Sec 12(2) IGST Act.
const SUPPLIER_STATE = "Uttar Pradesh";

export const generateBookingInvoiceTemplate = (booking) => {
  const consultation = booking.consultationId || {};
  const user = booking.userId || {};
  const transaction = booking.transactionId || {};

  const invoiceNo = `INV-${String(booking._id).slice(-8).toUpperCase()}`;
  const modeLabel =
    booking.mode === "audio"
      ? "🎙️ Audio Call"
      : booking.mode === "video"
        ? "📹 Video Call"
        : "🏢 In Person";

  const paymentStatusColor = {
    paid: { bg: "#e6f4ea", color: "#1a6b2f", dot: "#22c55e" },
    pending: { bg: "#fff8e1", color: "#92400e", dot: "#f59e0b" },
    failed: { bg: "#fdecea", color: "#991b1b", dot: "#ef4444" },
  };
  const ps =
    paymentStatusColor[transaction.status] || paymentStatusColor.pending;

  const originalPrice = booking.price?.inr || 0;
  const discountAmount = booking.discountAmount || 0;
  const gstRate = booking.gst?.rate || 0;
  const gstAmount = booking.gst?.amount || 0;
  // Grand total is the actual amount payable (post-discount, incl. GST), not
  // the consultation's list price — the two only match when no discount was
  // applied.
  const totalPrice = booking.amount || 0;
  // Pre-GST bookings default gst.taxableAmount to 0 (not null/undefined), so
  // only trust it when there's an actual tax amount — otherwise the subtotal
  // is just the discounted price.
  const taxableAmount =
    gstAmount > 0
      ? booking.gst?.taxableAmount || originalPrice - discountAmount
      : originalPrice - discountAmount;

  const discountRowHtml =
    discountAmount > 0
      ? `
            <tr>
              <td style="padding:5px 0;font-size:13px;color:#6b7280;border:none;">Item Price</td>
              <td style="padding:5px 0;font-size:13px;text-align:right;color:#374151;border:none;">${fmt(originalPrice)}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;font-size:13px;color:#1a6b2f;border:none;">Discount${booking.discountType === "PERCENTAGE" ? ` (${booking.discountValue}%)` : ""}</td>
              <td style="padding:5px 0;font-size:13px;text-align:right;color:#1a6b2f;border:none;">− ${fmt(discountAmount)}</td>
            </tr>`
      : "";

  const gstRowsHtml =
    gstAmount > 0
      ? `${discountRowHtml}
            <tr>
              <td style="padding:5px 0;font-size:13px;color:#6b7280;border:none;">Subtotal (Excl. GST)</td>
              <td style="padding:5px 0;font-size:13px;text-align:right;color:#374151;border:none;">${fmt(taxableAmount)}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;font-size:13px;color:#6b7280;border:none;">GST (${gstRate}%) — Included</td>
              <td style="padding:5px 0;font-size:13px;text-align:right;color:#374151;border:none;">${fmt(gstAmount)}</td>
            </tr>`
      : `${discountRowHtml}
            <tr>
              <td style="padding:5px 0;font-size:13px;color:#6b7280;border:none;">Subtotal</td>
              <td style="padding:5px 0;font-size:13px;text-align:right;color:#374151;border:none;">${fmt(taxableAmount)}</td>
            </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Invoice ${invoiceNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'DM Sans', sans-serif;
      background: #f4f1eb;
      color: #1a1a2e;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      max-width: 800px;
      margin: 32px auto;
      background: #fff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 8px 48px rgba(26,26,46,0.13);
    }
    .inv-header {
      background: linear-gradient(135deg, #1a1a2e 0%, #2c1f4a 55%, #1a1a2e 100%);
      padding: 40px 44px 36px;
      position: relative;
      overflow: hidden;
    }
    .inv-header::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        radial-gradient(circle at 80% 20%, rgba(196,169,106,0.12) 0%, transparent 50%),
        radial-gradient(circle at 10% 80%, rgba(124,58,237,0.08) 0%, transparent 40%);
    }
    .inv-header-inner {
      position: relative;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
    }
    .brand-name {
      font-family: 'Cormorant Garamond', serif;
      font-size: 28px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 0.01em;
      line-height: 1.1;
    }
    .brand-tagline {
      font-size: 10.5px;
      color: #c4a96a;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .brand-meta {
      margin-top: 14px;
      font-size: 12px;
      color: rgba(255,255,255,0.55);
      line-height: 1.9;
    }
    .inv-label {
      font-family: 'Cormorant Garamond', serif;
      font-size: 38px;
      font-weight: 700;
      color: #c4a96a;
      letter-spacing: 0.06em;
      text-align: right;
      line-height: 1;
    }
    .inv-number {
      font-size: 12.5px;
      color: rgba(255,255,255,0.6);
      text-align: right;
      margin-top: 6px;
      letter-spacing: 0.08em;
    }
    .inv-dates {
      margin-top: 10px;
      font-size: 12px;
      color: rgba(255,255,255,0.45);
      text-align: right;
      line-height: 1.9;
    }
    .gold-bar {
      height: 3px;
      background: linear-gradient(90deg, transparent, #c4a96a 20%, #e8d48b 50%, #c4a96a 80%, transparent);
    }
    .status-strip {
      background: #fdfcf9;
      border-bottom: 1px solid #eee8db;
      padding: 14px 44px;
      display: flex;
      gap: 28px;
      align-items: center;
      flex-wrap: wrap;
    }
    .status-label {
      color: #9ca3af;
      font-size: 10.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-right: 6px;
    }
    .inv-body { padding: 36px 44px 40px; }
    .cards-row {
      display: flex;
      gap: 16px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }
    .card {
      flex: 1;
      min-width: 200px;
      background: #fafaf8;
      border: 1px solid #e5e0d5;
      border-radius: 12px;
      padding: 18px;
    }
    .card-title {
      font-size: 10px;
      font-weight: 700;
      color: #a8916a;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .card-body {
      font-size: 13px;
      line-height: 1.9;
      color: #374151;
    }
    .table-wrap {
      border: 1px solid #e8e2d5;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: linear-gradient(135deg, #1a1a2e, #2c1f4a); }
    thead th {
      padding: 13px 16px;
      font-size: 10.5px;
      font-weight: 600;
      color: #c4a96a;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      text-align: left;
    }
    thead th:last-child { text-align: right; }
    tbody td { padding: 16px; font-size: 14px; color: #374151; border-bottom: 1px solid #f0ece4; }
    tbody td:last-child { text-align: right; font-weight: 700; color: #1a1a2e; }
    .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 28px; }
    .totals-inner { width: 280px; border: 1px solid #e8e2d5; border-radius: 12px; overflow: hidden; }
    .grand-row {
      background: linear-gradient(135deg, #1a1a2e, #2c1f4a);
      padding: 15px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .grand-label {
      font-family: 'Cormorant Garamond', serif;
      font-size: 16px;
      font-weight: 600;
      color: rgba(255,255,255,0.85);
    }
    .grand-amount {
      font-family: 'Cormorant Garamond', serif;
      font-size: 22px;
      font-weight: 700;
      color: #c4a96a;
    }
    .inv-footer {
      background: #fdfcf9;
      border-top: 1px solid #eee8db;
      padding: 18px 44px;
      font-size: 11.5px;
      color: #a8916a;
      text-align: center;
      line-height: 1.8;
    }
    @media print {
      body { background: #fff; }
      .page { margin: 0; border-radius: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="inv-header">
    <div class="inv-header-inner">
      <div>
        <div class="brand-name">ASTRO SUSHIL PRIVATE LIMITED</div>
        <div class="brand-tagline">Gupt Nadi Astrology · Vastu Shastra · Tantra</div>
        <div class="brand-meta">
          FLAT NO-1204, 12TH FLOOR, TOWER B-3 SECTOR 121, Gautam Buddha Nagar, Gautam Buddha Nagar, Gautam Buddha Nagar- 201316, Uttar Pradesh<br/>
          GSTIN: ${SUPPLIER_GSTIN}<br/>
          📧 connect@astrosushil.com &nbsp;·&nbsp; 📞 +91 6393551359<br/>
          🌐 www.astrosushil.com
        </div>
      </div>
      <div>
        <div class="inv-label">INVOICE</div>
        <div class="inv-number">${invoiceNo}</div>
        <div class="inv-dates">
          Booked On: ${fmtDate(booking.createdAt)}<br/>
          Scheduled: ${booking.date || "—"}
        </div>
      </div>
    </div>
  </div>

  <div class="gold-bar"></div>

  <!-- Status strip -->
  <div class="status-strip">
    <div>
      <span class="status-label">Booking ID</span>
      <span style="font-family:monospace;font-size:12px;color:#374151;font-weight:600;">
        ${String(booking._id).slice(-10).toUpperCase()}
      </span>
    </div>
    <div>
      <span class="status-label">Slot</span>
      <span style="font-size:13px;font-weight:600;color:#1a1a2e;">${booking.slot || "—"}</span>
    </div>
    <div>
      <span class="status-label">Mode</span>
      <span style="font-size:13px;font-weight:600;color:#1a1a2e;">${modeLabel}</span>
    </div>
    <div>
      <span class="status-label">Place of Supply</span>
      <span style="font-size:13px;font-weight:600;color:#1a1a2e;">${SUPPLIER_STATE}</span>
    </div>
    <div>
      <span class="status-label">Reverse Charge</span>
      <span style="font-size:13px;font-weight:600;color:#1a1a2e;">No</span>
    </div>
    <div style="margin-left:auto;">
      <span class="status-label">Payment</span>
      <span style="
        display:inline-flex;align-items:center;gap:5px;
        background:${ps.bg};color:${ps.color};
        padding:3px 11px;border-radius:999px;
        font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
        <span style="width:6px;height:6px;border-radius:50%;background:${ps.dot};display:inline-block;"></span>
        ${transaction.status || "pending"}
      </span>
    </div>
  </div>

  <!-- Body -->
  <div class="inv-body">

    <!-- Customer + Payment cards -->
    <div class="cards-row">
      <div class="card">
        <div class="card-title">Customer Details</div>
        <div class="card-body">
          <strong style="color:#1a1a2e;font-size:14px;">
            ${user.firstName || ""} ${user.lastName || ""}
          </strong><br/>
          ${user.email ? `📧 ${user.email}<br/>` : ""}
          ${user.phoneNumber ? `📞 ${user.phoneNumber}` : ""}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Payment Details</div>
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;">
            <span style="color:#6b7280;">Method</span>
            <span style="font-weight:600;color:#1a1a2e;text-transform:capitalize;">
              ${transaction.method || "Razorpay"}
            </span>
          </div>
          ${
            transaction.transactionId
              ? `<div style="display:flex;justify-content:space-between;margin-top:4px;">
                  <span style="color:#6b7280;">Txn ID</span>
                  <span style="font-family:monospace;font-size:11px;">${transaction.transactionId}</span>
                </div>`
              : ""
          }
          <div style="display:flex;justify-content:space-between;margin-top:4px;">
            <span style="color:#6b7280;">Date</span>
            <span>${fmtDate(transaction.updatedAt || booking.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Consultation table -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Consultation</th>
            <th>Duration</th>
            <th>Mode</th>
            <th>Slot</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div style="font-weight:600;color:#1a1a2e;">${consultation.title || "Consultation"}</div>
              <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${consultation.priceLabel || booking.priceLabel || ""}</div>
            </td>
            <td>${booking.duration || consultation.duration || "—"} mins</td>
            <td>${modeLabel}</td>
            <td>${booking.date || "—"}, ${booking.slot || "—"}</td>
            <td>${fmt(booking.price?.inr || 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Total -->
    <div class="totals-wrap">
      <div class="totals-inner">
        <div style="padding:10px 16px 4px;">
          <table>${gstRowsHtml}
          </table>
        </div>
        <div class="grand-row">
          <span class="grand-label">Grand Total</span>
          <span class="grand-amount">${fmt(totalPrice)}</span>
        </div>
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div class="inv-footer">
    <strong style="color:#c4a96a;">For Astro Sushil Private Limited</strong> &nbsp;·&nbsp; Authorized Signatory<br/>
    Thank you for your trust and belief.<br/>
    This is a system-generated invoice and does not require a physical signature.
  </div>

</div>
</body>
</html>`;
};
