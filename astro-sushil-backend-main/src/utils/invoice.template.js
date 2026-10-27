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
    : new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

const paymentBadge = (status = "") => {
  const s = status.toLowerCase();
  const map = {
    paid: { bg: "#e6f4ea", color: "#1a6b2f", dot: "#22c55e" },
    pending: { bg: "#fff8e1", color: "#92400e", dot: "#f59e0b" },
    failed: { bg: "#fdecea", color: "#991b1b", dot: "#ef4444" },
  };
  const style = map[s] || map.pending;
  return `<span style="
    display:inline-flex;align-items:center;gap:6px;
    background:${style.bg};color:${style.color};
    padding:4px 12px;border-radius:999px;
    font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
    <span style="width:6px;height:6px;border-radius:50%;background:${style.dot};display:inline-block;"></span>
    ${status}
  </span>`;
};

const orderBadge = (status = "") => {
  const s = status.toLowerCase();
  const map = {
    delivered: { bg: "#e6f4ea", color: "#1a6b2f" },
    processing: { bg: "#f3f0ff", color: "#5b21b6" },
    shipped: { bg: "#e0f2fe", color: "#0369a1" },
    cancelled: { bg: "#fdecea", color: "#991b1b" },
    pending: { bg: "#fff8e1", color: "#92400e" },
  };
  const style = map[s] || { bg: "#f3f4f6", color: "#374151" };
  return `<span style="
    background:${style.bg};color:${style.color};
    padding:4px 12px;border-radius:999px;
    font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
    ${status}
  </span>`;
};

const itemTypeBadge = (type = "") => {
  if (!type) return "";
  const isDigital = type.toLowerCase() === "digital";
  return `<div style="margin-top:4px;">
    <span style="
      background:${isDigital ? "#f3f0ff" : "#fff7ed"};
      color:${isDigital ? "#5b21b6" : "#92400e"};
      font-size:10px;font-weight:600;
      padding:2px 8px;border-radius:999px;letter-spacing:0.05em;">
      ${isDigital ? "⚡ Digital" : "📦 Physical"}
    </span>
  </div>`;
};

const SUPPLIER_GSTIN = "09ABFCA5917P1Z2";
const SUPPLIER_STATE = "Uttar Pradesh";

export const generateInvoiceTemplate = (order, persistedInvoiceNumber) => {
  const round2 = (n) => Math.round(n * 100) / 100;

  const itemRows = (order.items || []).map((item) => ({
    ...item,
    lineTotal: round2((item.price || 0) * (item.quantity || 1)),
  }));

  const subtotal = round2(itemRows.reduce((acc, i) => acc + i.lineTotal, 0));
  const discount = round2(order.discountAmount || 0);
  const shipping = round2(order.shipping || 0);
  const afterDiscount = round2(subtotal - discount);

  // Tax computed on afterDiscount (before shipping)
  const taxAmount = order.tax;

  // Group per-item tax by rate so each GST% actually charged is called out,
  // instead of collapsing to a generic "GST" label when items differ.
  const taxByRate = new Map();
  itemRows.forEach((rawItem) => {
    const item = rawItem._doc || rawItem;
    const rate = item.taxRate || 0;
    const amount = item.taxAmount || 0;
    if (rate > 0 && amount > 0) {
      taxByRate.set(rate, round2((taxByRate.get(rate) || 0) + amount));
    }
  });
  const taxBreakdown = [...taxByRate.entries()].sort((a, b) => a[0] - b[0]);

  // Grand total — use order.totalAmount if provided, else compute
  const grandTotal =
    order.totalAmount != null
      ? round2(order.totalAmount)
      : round2(afterDiscount + shipping + taxAmount);

  const addr = order.shippingAddress || {};
  const payment = order.payment || {};
  const invoiceNo =
    persistedInvoiceNumber ||
    order.invoiceNumber ||
    `INV-${String(order._id || "")
      .slice(-8)
      .toUpperCase()}`;
  // Place of supply: delivery state for physical orders; falls back to the
  // supplier's own state (per Sec 12(2) IGST Act default) when no address
  // is on record, e.g. digital-only orders.
  const placeOfSupply = addr.state || SUPPLIER_STATE;

  // ── Item rows HTML ─────────────────────────────────────────────────────────
  const itemRowsHTML = itemRows
    .map((rawItem, i) => {
      const item = rawItem.toObject ? rawItem.toObject() : rawItem;

      return `
      <tr style="border-bottom:1px solid #f0ece4;${i % 2 === 1 ? "background:#fdfcf9;" : ""}">
        <td style="padding:14px 16px;color:#6b7280;font-size:13px;text-align:center;vertical-align:top;">
          ${i + 1}
        </td>
        <td style="padding:14px 16px;vertical-align:top;">
          <div style="font-weight:600;font-size:14px;color:#1a1a2e;">${item._doc.name || "—"}</div>
          ${item._doc.description ? `<div style="font-size:12px;color:#9ca3af;margin-top:2px;">${item._doc.description}</div>` : ""}
          ${itemTypeBadge(item._doc.type)}
        </td>
        <td style="padding:14px 16px;text-align:center;font-size:14px;color:#374151;vertical-align:top;">
          ${item._doc.quantity || 1}
        </td>
        <td style="padding:14px 16px;text-align:right;font-size:14px;color:#374151;vertical-align:top;">
          ${fmt(item._doc.price || 0)}
        </td>
        <td style="padding:14px 16px;text-align:right;font-size:14px;font-weight:700;color:#1a1a2e;vertical-align:top;">
          ${fmt(item.lineTotal)}
        </td>
      </tr>`;
    })
    .join("");

  // ── Totals rows ────────────────────────────────────────────────────────────
  const totalsRows = [
    { label: "Subtotal", value: fmt(subtotal), muted: true },
    discount > 0
      ? {
          label: order.discountLabel || "Discount",
          value: `− ${fmt(discount)}`,
          green: true,
        }
      : null,
    shipping > 0
      ? { label: "📦 Shipping", value: fmt(shipping), muted: true }
      : null,
    ...(taxBreakdown.length
      ? taxBreakdown.map(([rate, amount]) => ({
          label: `GST ${rate}%`,
          value: fmt(amount),
          muted: true,
        }))
      : taxAmount > 0
        ? [{ label: "GST", value: fmt(taxAmount), muted: true }]
        : []),
  ]
    .filter(Boolean)
    .map(
      (row) => `
      <tr>
        <td style="padding:6px 16px;font-size:13px;color:${row.green ? "#16a34a" : "#6b7280"};">
          ${row.label}
        </td>
        <td style="padding:6px 16px;text-align:right;font-size:13px;color:${row.green ? "#16a34a" : "#374151"};">
          ${row.value}
        </td>
      </tr>`,
    )
    .join("");

  // ── Address block ──────────────────────────────────────────────────────────
  const hasAddress = addr.fullName || addr.addressLine1 || addr.city;
  const addressHTML = hasAddress
    ? `
    <div style="flex:1;min-width:200px;background:#fafaf8;border:1px solid #e5e0d5;border-radius:12px;padding:18px;">
      <div style="font-size:10px;font-weight:700;color:#a8916a;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;">
        Shipping Address
      </div>
      <div style="font-size:13px;line-height:1.8;color:#374151;">
        <strong style="color:#1a1a2e;font-size:14px;">${addr.fullName || ""}</strong><br/>
        ${addr.phone ? `<span style="color:#6b7280;">📞 ${addr.phone}</span><br/>` : ""}
        ${addr.addressLine1 || ""}${addr.addressLine2 ? `, ${addr.addressLine2}` : ""}<br/>
        ${[addr.city, addr.state].filter(Boolean).join(", ")}${addr.pincode ? ` — ${addr.pincode}` : ""}<br/>
        ${addr.country ? addr.country : ""}
      </div>
    </div>`
    : "";

  const paymentHTML = `
    <div style="flex:1;min-width:200px;background:#fafaf8;border:1px solid #e5e0d5;border-radius:12px;padding:18px;">
      <div style="font-size:10px;font-weight:700;color:#a8916a;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;">
        Payment Details
      </div>
      <div style="font-size:13px;line-height:2;color:#374151;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#6b7280;">Status</span>
          ${paymentBadge(payment.status)}
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#6b7280;">Method</span>
          <span style="font-weight:600;color:#1a1a2e;">${payment.method || "—"}</span>
        </div>
        ${
          payment.transactionId
            ? `
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#6b7280;">Txn ID</span>
          <span style="font-family:monospace;font-size:12px;color:#374151;">${payment.transactionId}</span>
        </div>`
            : ""
        }
        ${
          payment.paidAt
            ? `
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#6b7280;">Paid On</span>
          <span style="color:#374151;">${fmtDate(payment.paidAt)}</span>
        </div>`
            : ""
        }
      </div>
    </div>`;

  // ── Digital delivery notice ────────────────────────────────────────────────
  const hasDigital = (order.items || []).some(
    (i) => (i.type || "").toLowerCase() === "digital",
  );
  const digitalNotice = hasDigital
    ? `<div style="
        background:#f3f0ff;border-left:4px solid #7c3aed;
        border-radius:0 10px 10px 0;padding:13px 18px;
        margin-bottom:24px;font-size:13px;color:#5b21b6;line-height:1.6;">
        ⚡ <strong>Digital items</strong> will be delivered to your registered email within
        <strong>24–48 hours</strong> of order confirmation.
      </div>`
    : "";

  // ── Notes ──────────────────────────────────────────────────────────────────
  const notesHTML = order.notes
    ? `<div style="background:#fafaf8;border:1px solid #e5e0d5;border-radius:10px;padding:16px;margin-top:24px;">
        <div style="font-size:10px;font-weight:700;color:#a8916a;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:8px;">Notes</div>
        <div style="font-size:13px;color:#6b7280;line-height:1.7;">${order.notes}</div>
      </div>`
    : "";

  // ── Full HTML ──────────────────────────────────────────────────────────────
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

    /* ── Header ── */
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

    /* ── Gold bar ── */
    .gold-bar {
      height: 3px;
      background: linear-gradient(90deg, transparent, #c4a96a 20%, #e8d48b 50%, #c4a96a 80%, transparent);
    }

    /* ── Status strip ── */
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

    /* ── Body ── */
    .inv-body { padding: 36px 44px 40px; }

    /* ── Cards row ── */
    .cards-row {
      display: flex;
      gap: 16px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }

    /* ── Table ── */
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

    /* ── Totals ── */
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
      font-size: 16px;
      font-weight: 600;
      color: rgba(255,255,255,0.85);
      letter-spacing: 0.04em;
    }

    .grand-amount {
      font-family: 'Cormorant Garamond', serif;
      font-size: 22px;
      font-weight: 700;
      color: #c4a96a;
      letter-spacing: 0.02em;
    }

    /* ── Footer ── */
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

  <!-- ── Header ── -->
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
          Date: ${fmtDate(order.createdAt)}<br/>
          ${order.dueDate ? `Due: ${fmtDate(order.dueDate)}` : ""}
        </div>
      </div>
    </div>
  </div>

  <!-- ── Gold divider ── -->
  <div class="gold-bar"></div>

  <!-- ── Status strip ── -->
  <div class="status-strip">
    <div class="status-item">
      <span class="status-label">Order ID</span>
      <span style="font-family:monospace;font-size:12px;color:#374151;font-weight:600;">
        ${String(order._id || "")
          .slice(-12)
          .toUpperCase()}
      </span>
    </div>
    <div class="status-item">
      <span class="status-label">Order Status</span>
      ${orderBadge(order.orderStatus)}
    </div>
    <div class="status-item">
      <span class="status-label">Place of Supply</span>
      <span style="font-size:12.5px;color:#374151;font-weight:600;">${placeOfSupply}</span>
    </div>
    <div class="status-item">
      <span class="status-label">Reverse Charge</span>
      <span style="font-size:12.5px;color:#374151;font-weight:600;">No</span>
    </div>
    <div class="status-item" style="margin-left:auto;">
      <span class="status-label">Payment</span>
      ${paymentBadge(payment.status)}
    </div>
  </div>

  <!-- ── Body ── -->
  <div class="inv-body">

    <!-- Customer + Payment cards -->
    <div class="cards-row">
      ${addressHTML}
      ${paymentHTML}
    </div>

    <!-- Digital delivery notice -->
    ${digitalNotice}

    <!-- Items table -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:44px;">#</th>
            <th style="text-align:left;">Item</th>
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

    <!-- Totals -->
    <div class="totals-wrap">
      <div class="totals-inner">
        <table class="totals-rows">
          <tbody>
            ${totalsRows}
          </tbody>
        </table>
        <div class="grand-row">
          <span class="grand-label">Grand Total</span>
          <span class="grand-amount">${fmt(grandTotal)}</span>
        </div>
      </div>
    </div>

    <!-- Notes -->
    ${notesHTML}

  </div>

  <!-- ── Footer ── -->
  <div class="inv-footer">
    <strong style="color:#c4a96a;">For Astro Sushil Private Limited</strong> &nbsp;·&nbsp; Authorized Signatory
    <br/>Thank you for your trust and belief.
    <br/>This is a system-generated invoice and does not require a physical signature.
  </div>

</div>
</body>
</html>`;
};
