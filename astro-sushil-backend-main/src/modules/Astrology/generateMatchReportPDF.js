import PDFDocument from "pdfkit";
import fs from "fs";
const C = {
  bg: "#0F0C29",
  bgMid: "#302B63",
  bgEnd: "#24243e",
  gold: "#F5C518",
  goldLight: "#FFD966",
  accent: "#E040FB",
  accentBlue: "#40C4FF",
  white: "#FFFFFF",
  offWhite: "#EEE8F0",
  muted: "#A89EC9",
  cardBg: "#1E1B3A",
  cardBorder: "#3D3472",
  green: "#69F0AE",
  red: "#FF5252",
  rowOdd: "#16133A",
  rowEven: "#1E1B3A",
};

function hex(h) {
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return [r, g, b];
}

function fillRect(doc, x, y, w, h, color) {
  doc.rect(x, y, w, h).fill(color);
}

function roundRect(doc, x, y, w, h, r, fillColor, strokeColor, lineWidth) {
  doc.roundedRect(x, y, w, h, r);
  if (fillColor && strokeColor) {
    doc.fillAndStroke(fillColor, strokeColor);
  } else if (fillColor) {
    doc.fill(fillColor);
  } else if (strokeColor) {
    doc.lineWidth(lineWidth || 1).stroke(strokeColor);
  }
}

function text(doc, txt, x, y, opts = {}) {
  doc
    .fillColor(opts.color || C.white)
    .fontSize(opts.size || 11)
    .font(opts.font || "Helvetica")
    .text(txt, x, y, opts);
}

function scoreBar(doc, x, y, w, h, received, total, color) {
  roundRect(doc, x, y, w, h, h / 2, C.cardBorder, null);
  // fill
  const fillW = total > 0 ? Math.round((received / total) * w) : 0;
  if (fillW > 0) {
    roundRect(doc, x, y, fillW, h, h / 2, color, null);
  }
}

function sectionHeader(doc, title, y) {
  const pageW = doc.page.width;
  const margin = 40;
  const w = pageW - margin * 2;

  fillRect(doc, margin, y, w, 30, C.bgMid);
  fillRect(doc, margin, y, 4, 30, C.gold);

  doc
    .fillColor(C.gold)
    .fontSize(13)
    .font("Helvetica-Bold")
    .text(title, margin + 14, y + 8);

  return y + 42;
}

function drawCoverPage(doc, data) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;

  fillRect(doc, 0, 0, pageW, pageH, C.bg);
  fillRect(doc, 0, 0, pageW, pageH / 2, C.bgMid);

  doc
    .circle(pageW / 2, 120, 140)
    .fillOpacity(0.08)
    .fill(C.gold);
  doc
    .circle(pageW / 2, 120, 100)
    .fillOpacity(0.1)
    .fill(C.accent);
  doc.fillOpacity(1);

  // Om symbol area (decorative text)
  doc
    .fillColor(C.gold)
    .fillOpacity(0.15)
    .fontSize(130)
    .font("Helvetica-Bold")
    .text("ॐ", pageW / 2 - 55, 55);
  doc.fillOpacity(1);

  // Title
  doc
    .fillColor(C.gold)
    .fontSize(28)
    .font("Helvetica-Bold")
    .text("KUNDLI MATCHMAKING", 0, 200, { align: "center", width: pageW });

  doc
    .fillColor(C.offWhite)
    .fontSize(13)
    .font("Helvetica")
    .text("Vedic Astrological Compatibility Report", 0, 236, {
      align: "center",
      width: pageW,
    });

  // Divider
  doc
    .moveTo(pageW / 2 - 80, 262)
    .lineTo(pageW / 2 + 80, 262)
    .lineWidth(1)
    .strokeColor(C.gold)
    .stroke();

  // Score circle
  const cx = pageW / 2;
  const cy = 340;
  const totalPts = data.ashtakoota?.total?.total_points || 36;
  const receivedPts = data.ashtakoota?.total?.received_points || 0;
  const scorePercent =
    data.match_percentage || Math.round((receivedPts / totalPts) * 100);

  doc.circle(cx, cy, 70).lineWidth(6).strokeColor(C.gold).stroke();
  doc.circle(cx, cy, 60).fill(C.cardBg);

  doc
    .fillColor(C.gold)
    .fontSize(34)
    .font("Helvetica-Bold")
    .text(`${receivedPts}`, cx - 30, cy - 24, { width: 60, align: "center" });

  doc
    .fillColor(C.muted)
    .fontSize(11)
    .font("Helvetica")
    .text(`out of ${totalPts}`, cx - 40, cy + 14, {
      width: 80,
      align: "center",
    });

  doc
    .fillColor(C.goldLight)
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("ASHTAKOOTA SCORE", cx - 70, cy + 82, {
      width: 140,
      align: "center",
    });

  // Match percentage badge
  const badge = data.is_match_good ? C.green : C.red;
  roundRect(doc, cx - 60, cy + 100, 120, 28, 14, badge, null);
  doc
    .fillColor(C.bg)
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(`${scorePercent}% COMPATIBILITY`, cx - 60, cy + 108, {
      width: 120,
      align: "center",
    });

  // Info cards
  const cardY = 460;
  const cardW = 220;
  const gap = 20;
  const startX = (pageW - (cardW * 2 + gap)) / 2;

  ["Male", "Female"].forEach((gender, i) => {
    const gx = startX + i * (cardW + gap);
    roundRect(doc, gx, cardY, cardW, 90, 10, C.cardBg, C.cardBorder, 1);

    const icon = gender === "Male" ? "♂" : "♀";
    const iconColor = gender === "Male" ? C.accentBlue : C.accent;

    doc
      .fillColor(iconColor)
      .fontSize(22)
      .font("Helvetica-Bold")
      .text(icon, gx + 10, cardY + 12);

    doc
      .fillColor(C.offWhite)
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(gender, gx + 36, cardY + 14);

    const details = data[`${gender.toLowerCase()}_astro_details`] || {};
    doc
      .fillColor(C.muted)
      .fontSize(9)
      .font("Helvetica")
      .text(`Sign: ${details.sign || "Scorpio"}`, gx + 12, cardY + 40)
      .text(
        `Nakshatra: ${details.Naksahtra || "Vishakha"}`,
        gx + 12,
        cardY + 54,
      )
      .text(`Ascendant: ${details.ascendant || "Gemini"}`, gx + 12, cardY + 68);
  });

  // Footer note
  doc
    .fillColor(C.muted)
    .fontSize(9)
    .font("Helvetica")
    .text(
      "Generated on " +
        new Date().toLocaleDateString("en-IN", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      0,
      pageH - 50,
      {
        align: "center",
        width: pageW,
      },
    );
}

function drawAshtakootaPage(doc, ashtakoota) {
  const pageW = doc.page.width;
  const margin = 40;
  const w = pageW - margin * 2;
  let y = 40;

  doc
    .fillColor(C.gold)
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("Ashtakoota Analysis", margin, y);
  y += 30;

  doc
    .fillColor(C.muted)
    .fontSize(10)
    .font("Helvetica")
    .text(ashtakoota.conclusion?.report || "", margin, y, { width: w });
  y += 40;

  y = sectionHeader(doc, "Koot-wise Compatibility Breakdown", y);

  const cols = {
    koot: 110,
    desc: 170,
    male: 80,
    female: 80,
    scored: 60,
    total: 60,
  };
  const colX = {
    koot: margin,
    desc: margin + cols.koot,
    male: margin + cols.koot + cols.desc,
    female: margin + cols.koot + cols.desc + cols.male,
    scored: margin + cols.koot + cols.desc + cols.male + cols.female,
    total:
      margin + cols.koot + cols.desc + cols.male + cols.female + cols.scored,
  };

  fillRect(doc, margin, y, w, 22, C.bgMid);
  const headers = ["Koot", "Description", "Male", "Female", "Scored", "Total"];
  const colXArr = [
    colX.koot,
    colX.desc,
    colX.male,
    colX.female,
    colX.scored,
    colX.total,
  ];
  headers.forEach((h, i) => {
    doc
      .fillColor(C.gold)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(h, colXArr[i] + 4, y + 6, { width: Object.values(cols)[i] - 6 });
  });
  y += 22;

  const koots = [
    "varna",
    "vashya",
    "tara",
    "yoni",
    "maitri",
    "gan",
    "bhakut",
    "nadi",
  ];
  const kootLabels = [
    "Varna",
    "Vashya",
    "Tara",
    "Yoni",
    "Maitri",
    "Gan",
    "Bhakut",
    "Nadi",
  ];

  koots.forEach((k, idx) => {
    const row = ashtakoota[k] || {};
    const rowBg = idx % 2 === 0 ? C.rowOdd : C.rowEven;
    const scored = row.received_points || 0;
    const tot = row.total_points || 0;
    const isZero = scored === 0 && tot > 0;

    fillRect(doc, margin, y, w, 24, rowBg);

    doc.circle(colX.koot + 6, y + 12, 4).fill(isZero ? C.red : C.green);

    doc
      .fillColor(C.offWhite)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(kootLabels[idx], colX.koot + 14, y + 7);

    doc
      .fillColor(C.muted)
      .fontSize(8)
      .font("Helvetica")
      .text(row.description || "", colX.desc + 4, y + 7, {
        width: cols.desc - 8,
      })
      .text(row.male_koot_attribute || "", colX.male + 4, y + 7)
      .text(row.female_koot_attribute || "", colX.female + 4, y + 7);

    doc
      .fillColor(isZero ? C.red : C.green)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(`${scored}`, colX.scored + 4, y + 7)
      .fillColor(C.muted)
      .font("Helvetica")
      .text(`${tot}`, colX.total + 4, y + 7);

    scoreBar(
      doc,
      colX.scored + 20,
      y + 8,
      35,
      7,
      scored,
      tot,
      isZero ? C.red : C.green,
    );

    y += 24;
  });

  const tot = ashtakoota.total || {};
  fillRect(doc, margin, y, w, 28, C.bgMid);
  doc
    .fillColor(C.gold)
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("TOTAL SCORE", margin + 8, y + 7)
    .text(
      `${tot.received_points || 0} / ${tot.total_points || 36}`,
      colX.scored - 10,
      y + 7,
    )
    .fillColor(C.muted)
    .fontSize(9)
    .font("Helvetica")
    .text(
      `(Minimum required: ${tot.minimum_required || 18})`,
      colX.scored + 50,
      y + 10,
    );
  y += 40;

  y = sectionHeader(doc, "Compatibility Metrics", y);
  y += 6;

  const metrics = [
    {
      label: "Ashtakoota",
      value: `${data_ref.ashtakoota_percentage || 78}%`,
      color: C.gold,
    },
    {
      label: "Manglik Match",
      value: `${data_ref.manglik_match_percentage || 85}%`,
      color: C.green,
    },
    {
      label: "Vedha Match",
      value: `${data_ref.vedha_match_percentage || 100}%`,
      color: C.accentBlue,
    },
    {
      label: "Overall Match",
      value: `${data_ref.match_percentage || 72}%`,
      color: C.accent,
    },
  ];

  const mCardW = (w - 30) / 4;
  metrics.forEach((m, i) => {
    const mx = margin + i * (mCardW + 10);
    roundRect(doc, mx, y, mCardW, 70, 8, C.cardBg, C.cardBorder, 1);
    doc
      .fillColor(m.color)
      .fontSize(22)
      .font("Helvetica-Bold")
      .text(m.value, mx, y + 12, { width: mCardW, align: "center" });
    doc
      .fillColor(C.muted)
      .fontSize(8)
      .font("Helvetica")
      .text(m.label, mx, y + 46, { width: mCardW, align: "center" });
  });

  return y + 80;
}

let data_ref = {};

function drawDoshaPage(doc, data) {
  const pageW = doc.page.width;
  const margin = 40;
  const w = pageW - margin * 2;
  let y = 40;

  doc
    .fillColor(C.gold)
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("Dosha Analysis", margin, y);
  y += 36;

  // ── Manglik ──
  y = sectionHeader(doc, "Manglik Dosha", y);

  const manglik = data.male || {};
  const fmanglik = data.female || {};

  ["Male", "Female"].forEach((g, gi) => {
    const md = gi === 0 ? manglik : fmanglik;
    const bx = margin + gi * (w / 2 + 5);
    const bw = w / 2 - 5;

    roundRect(doc, bx, y, bw, 140, 10, C.cardBg, C.cardBorder, 1);

    const iconColor = g === "Male" ? C.accentBlue : C.accent;
    doc
      .fillColor(iconColor)
      .fontSize(13)
      .font("Helvetica-Bold")
      .text(g === "Male" ? "♂ Male" : "♀ Female", bx + 10, y + 10);

    const statusColor = md.is_present ? C.red : C.green;
    const statusTxt = md.manglik_status || "INEFFECTIVE";
    roundRect(
      doc,
      bx + bw - 100,
      y + 6,
      90,
      20,
      10,
      statusColor + "33",
      statusColor,
      1,
    );
    doc
      .fillColor(statusColor)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(statusTxt, bx + bw - 100, y + 11, { width: 90, align: "center" });

    // Percentage arc-like bar
    const pct = md.percentage_manglik_present || 0;
    doc
      .fillColor(C.muted)
      .fontSize(9)
      .font("Helvetica")
      .text(`Manglik %: ${pct}%`, bx + 10, y + 36);

    scoreBar(doc, bx + 10, y + 50, bw - 20, 8, pct, 100, statusColor);

    doc
      .fillColor(C.offWhite)
      .fontSize(8)
      .font("Helvetica")
      .text(md.manglik_report || "", bx + 10, y + 66, { width: bw - 20 });

    // Cancellations
    if (md.manglik_cancel_rule?.length) {
      doc
        .fillColor(C.green)
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("✓ Cancellation Applied", bx + 10, y + 106);
      doc
        .fillColor(C.muted)
        .fontSize(7.5)
        .font("Helvetica")
        .text(md.manglik_cancel_rule[0], bx + 10, y + 118, { width: bw - 20 });
    }
  });

  y += 152;

  // Conclusion
  const mConclusion = data.conclusion || {};
  const conclColor = mConclusion.match ? C.green : C.red;
  roundRect(doc, margin, y, w, 50, 8, conclColor + "15", conclColor, 1);
  doc
    .fillColor(conclColor)
    .fontSize(9)
    .font("Helvetica-Bold")
    .text("CONCLUSION", margin + 12, y + 8);
  doc
    .fillColor(C.offWhite)
    .fontSize(9)
    .font("Helvetica")
    .text(mConclusion.report || "", margin + 12, y + 22, { width: w - 24 });

  y += 62;

  // ── Vedha & Rajju ──
  y = sectionHeader(doc, "Vedha & Rajju Dosha", y);

  const doshas = [
    {
      name: "Vedha Dosha",
      present: data_ref.vedha_dosha?.status === false,
      absent: true,
      report: data_ref.vedha_report?.vedha_report || "No Vedha Dosha present.",
      color: C.green,
    },
    {
      name: "Rajju Dosha",
      present: !data_ref.rajju_dosha?.status,
      absent: data_ref.rajju_dosha?.status,
      report: data_ref.rajju_dosha?.status
        ? "Rajju Dosha is present. Remedies are recommended."
        : "No Rajju Dosha detected.",
      color: data_ref.rajju_dosha?.status ? C.red : C.green,
    },
  ];

  doshas.forEach((d, i) => {
    const dx = margin + i * (w / 2 + 10);
    const dw = w / 2 - 5;
    roundRect(doc, dx, y, dw, 80, 10, C.cardBg, d.color + "66", 1);

    const badge = d.absent ? C.green : C.red;
    const badgeTxt = d.absent ? "CLEAR" : "PRESENT";
    roundRect(doc, dx + dw - 74, y + 8, 64, 18, 9, badge, null);
    doc
      .fillColor(C.bg)
      .fontSize(8)
      .font("Helvetica-Bold")
      .text(badgeTxt, dx + dw - 74, y + 13, { width: 64, align: "center" });

    doc
      .fillColor(d.color)
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(d.name, dx + 10, y + 12);
    doc
      .fillColor(C.muted)
      .fontSize(8.5)
      .font("Helvetica")
      .text(d.report, dx + 10, y + 30, { width: dw - 20 });
  });

  y += 96;

  // ── Overall Conclusion ──
  y = sectionHeader(doc, "Final Match Conclusion", y);

  const finalReport =
    data_ref.final_conclusion?.match_report ||
    data_ref.ashtakoota?.conclusion?.report ||
    "";
  const isGood = data_ref.is_match_good;
  const fcColor = isGood ? C.green : C.red;

  roundRect(doc, margin, y, w, 80, 10, fcColor + "10", fcColor, 1.5);

  // Big icon
  doc
    .fillColor(fcColor)
    .fontSize(32)
    .font("Helvetica-Bold")
    .text(isGood ? "✓" : "✗", margin + 16, y + 20);

  doc
    .fillColor(fcColor)
    .fontSize(13)
    .font("Helvetica-Bold")
    .text(
      isGood ? "MATCH RECOMMENDED" : "MATCH NOT RECOMMENDED",
      margin + 56,
      y + 14,
    );

  doc
    .fillColor(C.offWhite)
    .fontSize(9)
    .font("Helvetica")
    .text(finalReport, margin + 56, y + 32, { width: w - 70 });

  y += 96;

  // ── Planet Details ──
  y = sectionHeader(doc, "Planetary Positions", y);

  const planets = data_ref.male_planet_details || [];
  if (planets.length) {
    const ph = ["Planet", "Sign", "House", "Nakshatra", "Retro", "Awastha"];
    const pw = [70, 70, 40, 100, 40, 60];
    let px = margin;

    fillRect(doc, margin, y, w, 20, C.bgMid);
    ph.forEach((h, i) => {
      doc
        .fillColor(C.gold)
        .fontSize(8)
        .font("Helvetica-Bold")
        .text(h, px + 3, y + 5, { width: pw[i] });
      px += pw[i];
    });
    y += 20;

    planets.slice(0, 9).forEach((p, idx) => {
      const rb = idx % 2 === 0 ? C.rowOdd : C.rowEven;
      fillRect(doc, margin, y, w, 18, rb);
      px = margin;
      const vals = [
        p.name,
        p.sign,
        `H${p.house}`,
        p.nakshatra,
        p.isRetro === "true" ? "Yes" : "No",
        p.planet_awastha || "",
      ];
      const vcolors = [
        C.offWhite,
        C.accentBlue,
        C.muted,
        C.muted,
        p.isRetro === "true" ? C.red : C.green,
        C.muted,
      ];

      vals.forEach((v, i) => {
        doc
          .fillColor(vcolors[i])
          .fontSize(8)
          .font(i === 0 ? "Helvetica-Bold" : "Helvetica")
          .text(v, px + 3, y + 4, { width: pw[i] });
        px += pw[i];
      });
      y += 18;
    });
  }
}

export function generateMatchReport(apiData, outputPath) {
  return new Promise((resolve, reject) => {
    data_ref = {
      ...apiData,
      male_planet_details: apiData.male_planet_details || [],
      female_planet_details: apiData.female_planet_details || [],
      ashtakoota: apiData.ashtakoota || apiData,
      vedha_report: apiData,
      rajju_dosha: apiData.rajju_dosha || {},
      vedha_dosha: apiData.vedha_dosha || {},
      final_conclusion: apiData.conclusion || {},
      ashtakoota_percentage: apiData.ashtakoota_percentage || 78,
      manglik_match_percentage: apiData.manglik_match_percentage || 85,
      vedha_match_percentage: apiData.vedha_match_percentage || 100,
      match_percentage: apiData.match_percentage || 72,
      is_match_good:
        apiData.is_match_good !== undefined ? apiData.is_match_good : true,
    };

    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: { Title: "Kundli Match Report" },
    });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    fillRect(doc, 0, 0, doc.page.width, doc.page.height, C.bg);
    drawCoverPage(doc, apiData);

    doc.addPage();
    fillRect(doc, 0, 0, doc.page.width, doc.page.height, C.bg);
    drawAshtakootaPage(doc, data_ref.ashtakoota || {});

    doc.addPage();
    fillRect(doc, 0, 0, doc.page.width, doc.page.height, C.bg);
    drawDoshaPage(doc, apiData.manglik || apiData);

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}
