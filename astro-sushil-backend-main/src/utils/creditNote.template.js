// Credit note for a refunded Return — deliberately mirrors invoice.template.js's
// exact design system (fonts, palette, header/footer, table styling) so a
// credit note reads as the same document family as the order invoice it's
// issued against, just with "CREDIT NOTE" branding and refund figures.

// Mirrors formatCurrency() in src/utils/emailTemplates.js — same
// Intl.NumberFormat-based approach (currency symbol comes from the ISO
// currency code itself, no manual symbol map needed) so credit notes render
// the order's actual payment currency instead of assuming INR.
const fmt = (amount, currency = "INR") => {
  const num = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toLocaleString()}`;
  }
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

const statusBadge = (status = "", map, fallback = { bg: "#f3f4f6", color: "#374151" }) => {
  const style = map[String(status).toLowerCase()] || fallback;
  return `<span style="
    background:${style.bg};color:${style.color};
    padding:4px 12px;border-radius:999px;
    font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
    ${status}
  </span>`;
};

const RETURN_STATUS_COLORS = {
  refunded: { bg: "#e6f4ea", color: "#1a6b2f" },
  approved_for_refund: { bg: "#e0f2fe", color: "#0369a1" },
  rejected: { bg: "#fdecea", color: "#991b1b" },
};

const REFUND_METHOD_COLORS = {
  success: { bg: "#e6f4ea", color: "#1a6b2f", dot: "#22c55e" },
  pending: { bg: "#fff8e1", color: "#92400e", dot: "#f59e0b" },
  failed: { bg: "#fdecea", color: "#991b1b", dot: "#ef4444" },
};

const refundStatusBadge = (status = "") => {
  const style = REFUND_METHOD_COLORS[String(status).toLowerCase()] || REFUND_METHOD_COLORS.pending;
  return `<span style="
    display:inline-flex;align-items:center;gap:6px;
    background:${style.bg};color:${style.color};
    padding:4px 12px;border-radius:999px;
    font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
    <span style="width:6px;height:6px;border-radius:50%;background:${style.dot};display:inline-block;"></span>
    ${status}
  </span>`;
};

const SUPPLIER_GSTIN = "09ABFCA5917P1Z2";
const SUPPLIER_STATE = "Uttar Pradesh";

/**
 * @param {object} params
 * @param {object} params.returnDoc - the Return document (refunded)
 * @param {object} params.order - the parent Order document
 * @param {object|null} params.transaction - the refund Transaction, if any
 * @param {Array<{name, quantity, price, taxRate, taxAmount, lineTotal}>} params.items
 *   pre-joined return line items (Return.items[] joined against Order.items[]
 *   for price/tax — the Return doc itself carries no price/tax fields).
 */
export const generateCreditNoteTemplate = ({ returnDoc, order, transaction, items }) => {
  const currency = order?.payment?.currency || "INR";
  const round2 = (n) => Math.round(n * 100) / 100;

  const subtotal = round2(items.reduce((acc, i) => acc + i.lineTotal, 0));

  const taxByRate = new Map();
  items.forEach((item) => {
    if (item.taxRate > 0 && item.taxAmount > 0) {
      taxByRate.set(item.taxRate, round2((taxByRate.get(item.taxRate) || 0) + item.taxAmount));
    }
  });
  const taxBreakdown = [...taxByRate.entries()].sort((a, b) => a[0] - b[0]);
  const taxTotal = round2(taxBreakdown.reduce((acc, [, amount]) => acc + amount, 0));

  const shippingReversal = returnDoc.refundIncludesShipping ? round2(order.shipping || 0) : 0;

  // The refund amount actually issued is the source of truth (computed once
  // by processReturnRefund and never recomputed here) — subtotal + tax +
  // shipping-reversal is shown as a sanity breakdown, but the grand total
  // always reflects what was really credited to the customer.
  const grandTotal = round2(returnDoc.refundAmount ?? subtotal + taxTotal + shippingReversal);

  const addr = order.shippingAddress || {};
  // Both assigned once, on first credit-note view/download (see
  // utils/invoiceSequence.js) — the id-slice fallbacks only matter for a
  // return/order created before that existed and never re-downloaded since.
  const creditNoteNo =
    returnDoc.creditNoteNumber ||
    `CN-${String(returnDoc._id || "").slice(-8).toUpperCase()}`;
  const invoiceNo =
    order.invoiceNumber || `INV-${String(order._id || "").slice(-8).toUpperCase()}`;
  const placeOfSupply = addr.state || SUPPLIER_STATE;

  const itemRowsHTML = items
    .map(
      (item, i) => `
      <tr style="border-bottom:1px solid #f0ece4;${i % 2 === 1 ? "background:#fdfcf9;" : ""}">
        <td style="padding:14px 16px;color:#6b7280;font-size:13px;text-align:center;vertical-align:top;">
          ${i + 1}
        </td>
        <td style="padding:14px 16px;vertical-align:top;">
          <div style="font-weight:600;font-size:14px;color:#1a1a2e;">${item.name || "—"}</div>
        </td>
        <td style="padding:14px 16px;text-align:center;font-size:14px;color:#374151;vertical-align:top;">
          ${item.quantity || 1}
        </td>
        <td style="padding:14px 16px;text-align:right;font-size:14px;color:#374151;vertical-align:top;">
          ${fmt(item.price, currency)}
        </td>
        <td style="padding:14px 16px;text-align:right;font-size:14px;font-weight:700;color:#1a1a2e;vertical-align:top;">
          ${fmt(item.lineTotal, currency)}
        </td>
      </tr>`,
    )
    .join("");

  const totalsRows = [
    { label: "Returned Items Subtotal", value: fmt(subtotal, currency), muted: true },
    ...(taxBreakdown.length
      ? taxBreakdown.map(([rate, amount]) => ({
          label: `GST ${rate}% Reversed`,
          value: fmt(amount, currency),
          muted: true,
        }))
      : []),
    shippingReversal > 0
      ? { label: "📦 Shipping Reversed", value: fmt(shippingReversal, currency), muted: true }
      : null,
  ]
    .filter(Boolean)
    .map(
      (row) => `
      <tr>
        <td style="padding:6px 16px;font-size:13px;color:#6b7280;">${row.label}</td>
        <td style="padding:6px 16px;text-align:right;font-size:13px;color:#374151;">${row.value}</td>
      </tr>`,
    )
    .join("");

  const hasAddress = addr.fullName || addr.addressLine1 || addr.city;
  const addressHTML = hasAddress
    ? `
    <div style="flex:1;min-width:200px;background:#fafaf8;border:1px solid #e5e0d5;border-radius:12px;padding:18px;">
      <div style="font-size:10px;font-weight:700;color:#a8916a;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;">
        Customer
      </div>
      <div style="font-size:13px;line-height:1.8;color:#374151;">
        <strong style="color:#1a1a2e;font-size:14px;">${addr.fullName || ""}</strong><br/>
        ${addr.phone ? `<span style="color:#6b7280;">📞 ${addr.phone}</span><br/>` : ""}
        ${addr.addressLine1 || ""}${addr.addressLine2 ? `, ${addr.addressLine2}` : ""}<br/>
        ${[addr.city, addr.state].filter(Boolean).join(", ")}${addr.pincode ? ` — ${addr.pincode}` : ""}
      </div>
    </div>`
    : "";

  const refundHTML = `
    <div style="flex:1;min-width:200px;background:#fafaf8;border:1px solid #e5e0d5;border-radius:12px;padding:18px;">
      <div style="font-size:10px;font-weight:700;color:#a8916a;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;">
        Refund Details
      </div>
      <div style="font-size:13px;line-height:2;color:#374151;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#6b7280;">Status</span>
          ${refundStatusBadge(transaction?.status || "success")}
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#6b7280;">Method</span>
          <span style="font-weight:600;color:#1a1a2e;">${transaction?.method || order.payment?.method || "—"}</span>
        </div>
        ${
          transaction?.razorpayRefundId
            ? `
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#6b7280;">Refund ID</span>
          <span style="font-family:monospace;font-size:12px;color:#374151;">${transaction.razorpayRefundId}</span>
        </div>`
            : ""
        }
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#6b7280;">Refunded On</span>
          <span style="color:#374151;">${fmtDate(transaction?.createdAt || returnDoc.updatedAt)}</span>
        </div>
      </div>
    </div>`;

  const reasonHTML = returnDoc.reason || returnDoc.customerComment
    ? `<div style="background:#fafaf8;border:1px solid #e5e0d5;border-radius:10px;padding:16px;margin-top:24px;">
        <div style="font-size:10px;font-weight:700;color:#a8916a;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:8px;">Return Reason</div>
        <div style="font-size:13px;color:#6b7280;line-height:1.7;">
          ${[returnDoc.reason, returnDoc.customerComment].filter(Boolean).join(" — ")}
        </div>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Credit Note ${creditNoteNo}</title>
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
      font-size: 32px;
      font-weight: 700;
      color: #c4a96a;
      letter-spacing: 0.06em;
      text-align: right;
      line-height: 1;
    }

    .inv-number {
      font-family: 'DM Mono', monospace;
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

    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
    }

    .status-label {
      color: #9ca3af;
      font-size: 10.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .inv-body { padding: 36px 44px 40px; }

    .cards-row {
      display: flex;
      gap: 16px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
    }

    .table-wrap {
      border: 1px solid #e8e2d5;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 24px;
    }

    thead tr {
      background: linear-gradient(135deg, #1a1a2e, #2c1f4a);
    }

    thead th {
      padding: 13px 16px;
      font-size: 10.5px;
      font-weight: 600;
      color: #c4a96a;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    thead th:first-child { text-align: center; }
    thead th:nth-child(3) { text-align: center; }
    thead th:nth-child(4), thead th:nth-child(5) { text-align: right; }

    .totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 28px;
    }

    .totals-inner {
      width: 300px;
      border: 1px solid #e8e2d5;
      border-radius: 12px;
      overflow: hidden;
    }

    .totals-rows { padding: 12px 0 4px; }

    .grand-row {
      background: linear-gradient(135deg, #1a1a2e, #2c1f4a);
      padding: 15px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .grand-label {
      font-family: 'Cormorant Garamond', serif;
      font-size: 15px;
      font-weight: 600;
      color: rgba(255,255,255,0.85);
      letter-spacing: 0.03em;
    }

    .grand-amount {
      font-family: 'Cormorant Garamond', serif;
      font-size: 22px;
      font-weight: 700;
      color: #c4a96a;
      letter-spacing: 0.02em;
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
        <div class="inv-label">CREDIT NOTE</div>
        <div class="inv-number">${creditNoteNo}</div>
        <div class="inv-dates">
          Date: ${fmtDate(returnDoc.updatedAt)}<br/>
          Against Invoice: ${invoiceNo} (${fmtDate(order.createdAt)})
        </div>
      </div>
    </div>
  </div>

  <div class="gold-bar"></div>

  <div class="status-strip">
    <div class="status-item">
      <span class="status-label">Order ID</span>
      <span style="font-family:monospace;font-size:12px;color:#374151;font-weight:600;">
        ${String(order._id || "").slice(-8).toUpperCase()}
      </span>
    </div>
    <div class="status-item">
      <span class="status-label">Return Status</span>
      ${statusBadge(returnDoc.status, RETURN_STATUS_COLORS)}
    </div>
    <div class="status-item">
      <span class="status-label">Place of Supply</span>
      <span style="font-size:12.5px;color:#374151;font-weight:600;">${placeOfSupply}</span>
    </div>
    <div class="status-item">
      <span class="status-label">Reverse Charge</span>
      <span style="font-size:12.5px;color:#374151;font-weight:600;">No</span>
    </div>
  </div>

  <div class="inv-body">

    <div class="cards-row">
      ${addressHTML}
      ${refundHTML}
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:44px;">#</th>
            <th style="text-align:left;">Returned Item</th>
            <th style="width:60px;">Qty</th>
            <th style="width:110px;">Unit Price</th>
            <th style="width:120px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHTML}
        </tbody>
      </table>
    </div>

    <div class="totals-wrap">
      <div class="totals-inner">
        <table class="totals-rows">
          <tbody>
            ${totalsRows}
          </tbody>
        </table>
        <div class="grand-row">
          <span class="grand-label">Total Credited</span>
          <span class="grand-amount">${fmt(grandTotal, currency)}</span>
        </div>
      </div>
    </div>

    ${reasonHTML}

  </div>

  <div class="inv-footer">
    <strong style="color:#c4a96a;">For Astro Sushil Private Limited</strong> &nbsp;·&nbsp; Authorized Signatory
    <br/>This credit note confirms the amount above has been credited/refunded against the invoice referenced.
    <br/>This is a system-generated document and does not require a physical signature.
  </div>

</div>
</body>
</html>`;
};
