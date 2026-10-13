const fmt = (amount) =>
  `${
    amount != null
      ? `₹${Number(amount).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "₹0.00"
  }`;

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const reportTypeLabel = (type) => {
  const map = {
    basic_horoscope_pdf: "Basic Horoscope Report",
    mini_horoscope_pdf: "Mini Horoscope Report",
    pro_horoscope_pdf: "Pro Horoscope Report",
    match_making_pdf: "Match Making Report",
  };

  return map[type] || "Astrology Report";
};

const payerDetails = (order) => {
  if (order.reportType === "match_making_pdf") {
    const bride = order.matchMakingDetails?.bride || {};
    const groom = order.matchMakingDetails?.groom || {};
    return `
      <div style="margin-top:8px;font-size:13px;color:#374151;line-height:1.8;">
        <strong>Bride:</strong> ${bride.fullName || "—"}<br/>
        <strong>Groom:</strong> ${groom.fullName || "—"}
      </div>
    `;
  }

  const customer = order.customerDetails || {};
  return `
    <div style="margin-top:8px;font-size:13px;color:#374151;line-height:1.8;">
      <strong>${customer.fullName || "Customer"}</strong><br/>
      ${customer.email ? `📧 ${customer.email}<br/>` : ""}
      ${customer.whatsappNumber ? `📞 ${customer.whatsappNumber}` : ""}
    </div>
  `;
};

const SUPPLIER_GSTIN = "09ABFCA5917P1Z2";
// Report orders don't capture the customer's state, so place of supply
// defaults to the supplier's own state per Sec 12(2) IGST Act.
const SUPPLIER_STATE = "Uttar Pradesh";

export const generateReportInvoiceTemplate = ({ order, transaction, user }) => {
  const invoiceNo = `INV-${String(order._id).slice(-8).toUpperCase()}`;
  const paymentStatus = (
    transaction?.status ||
    order.paymentStatus ||
    "pending"
  ).toLowerCase();
  const paymentMethod = transaction?.method || "Razorpay";
  const txnId = transaction?.transactionId || order.razorpayPaymentId || "—";
  const paidAt =
    transaction?.updatedAt ||
    transaction?.createdAt ||
    order.updatedAt ||
    order.createdAt;

  const paymentBadges = {
    paid: { bg: "#e6f4ea", color: "#1a6b2f", dot: "#22c55e" },
    pending: { bg: "#fff8e1", color: "#92400e", dot: "#f59e0b" },
    failed: { bg: "#fdecea", color: "#991b1b", dot: "#ef4444" },
  };
  const paymentStyle = paymentBadges[paymentStatus] || paymentBadges.pending;

  const reportLabel = reportTypeLabel(order.reportType);
  const reportName = order.reportId?.name || reportLabel;

  const totalAmount = order.amount || 0;
  const gstRate = order.gst?.rate || 0;
  const gstAmount = order.gst?.amount || 0;
  // Pre-GST records default gst.taxableAmount to 0 (not null/undefined), so
  // only trust it when there's an actual tax amount — otherwise the subtotal
  // is just the total.
  const taxableAmount = gstAmount > 0 ? (order.gst?.taxableAmount || totalAmount) : totalAmount;

  const gstRowsHtml =
    gstAmount > 0
      ? `
            <tr>
              <td style="padding:5px 0;font-size:13px;color:#6b7280;border:none;">Subtotal</td>
              <td style="padding:5px 0;font-size:13px;text-align:right;color:#374151;border:none;">${fmt(taxableAmount)}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;font-size:13px;color:#6b7280;border:none;">GST (${gstRate}%) — Added</td>
              <td style="padding:5px 0;font-size:13px;text-align:right;color:#374151;border:none;">${fmt(gstAmount)}</td>
            </tr>`
      : `
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
      min-width: 220px;
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
          Order Date: ${fmtDate(order.createdAt)}<br/>
          Report: ${reportName}
        </div>
      </div>
    </div>
  </div>
  <div class="gold-bar"></div>
  <div class="status-strip">
    <div>
      <span class="status-label">Order ID</span>
      <span style="font-family:monospace;font-size:12px;color:#374151;font-weight:600;">
        ${String(order._id).slice(-10).toUpperCase()}
      </span>
    </div>
    <div>
      <span class="status-label">Report Type</span>
      <span style="font-size:13px;font-weight:600;color:#1a1a2e;">${reportTypeLabel(order.reportType)}</span>
    </div>
    <div>
      <span class="status-label">Place of Supply</span>
      <span style="font-size:13px;font-weight:600;color:#1a1a2e;">${SUPPLIER_STATE}</span>
    </div>
    <div>
      <span class="status-label">Reverse Charge</span>
      <span style="font-size:13px;font-weight:600;color:#1a1a2e;">No</span>
    </div>
    <div style="margin-left:auto; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
      <div>
        <span class="status-label">Payment</span>
        <span style="
          display:inline-flex;align-items:center;gap:5px;
          background:${paymentStyle.bg};color:${paymentStyle.color};
          padding:3px 11px;border-radius:999px;
          font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
          <span style="width:6px;height:6px;border-radius:50%;background:${paymentStyle.dot};display:inline-block;"></span>
          ${paymentStatus}
        </span>
      </div>
      <div>
        <span class="status-label">Report Status</span>
        <span style="font-size:13px;font-weight:600;color:#1a1a2e;">${order.reportStatus || "pending"}</span>
      </div>
    </div>
  </div>

  <div class="inv-body">
    <div class="cards-row">
      <div class="card">
        <div class="card-title">Customer Details</div>
        <div class="card-body">
          ${payerDetails(order)}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Payment Details</div>
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;">
            <span style="color:#6b7280;">Method</span>
            <span style="font-weight:600;color:#1a1a2e;">${paymentMethod}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;">
            <span style="color:#6b7280;">Txn ID</span>
            <span style="font-family:monospace;font-size:11px;">${txnId}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;">
            <span style="color:#6b7280;">Date</span>
            <span>${fmtDate(paidAt)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Report</th>
            <th>Type</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div style="font-weight:600;color:#1a1a2e;">${reportName}</div>
              <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${order.reportId?.subtitle || order.reportId?.description || "Astrology report purchase"}</div>
            </td>
            <td>${reportTypeLabel(order.reportType)}</td>
            <td style="text-align:right;">${fmt(order.amount)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="totals-wrap">
      <div class="totals-inner">
        <div style="padding:10px 16px 4px;">
          <table>${gstRowsHtml}
          </table>
        </div>
        <div class="grand-row">
          <span class="grand-label">Grand Total</span>
          <span class="grand-amount">${fmt(totalAmount)}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="inv-footer">
    <strong style="color:#c4a96a;">For Astro Sushil Private Limited</strong> &nbsp;·&nbsp; Authorized Signatory<br/>
    Thank you for your trust and belief.<br/>
    This is a system-generated invoice and does not require a physical signature.
  </div>
</div>
</body>
</html>`;
};
