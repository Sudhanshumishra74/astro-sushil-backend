import axios from "axios";
import sharp from "sharp";
import { writeFile } from "fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { uploadFile } from "../service/UploadAws.js";
import ReportOrder from "../modules/Reports/reportOrder.model.js";
import { ApiError } from "../utils/ApiError.js";

// Download helper
async function loadFile(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
  });
  return res.data;
}

// Normalize image (WEBP/PNG/JPG → JPG)
async function toJpg(buffer) {
  return await sharp(Buffer.from(buffer)).jpeg().toBuffer();
}

// FRONT PAGE (image + text)
async function createFrontPage(pdfDoc, bgBytes, userData) {
  const page = pdfDoc.addPage([595, 842]);

  const jpgBuffer = await sharp(Buffer.from(bgBytes)).jpeg().toBuffer();

  const bgImage = await pdfDoc.embedJpg(jpgBuffer);
  const { width, height } = page.getSize();

  // Background image
  page.drawImage(bgImage, {
    x: 0,
    y: 0,
    width,
    height,
  });

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const layout = {
    name: { x: 80, y: 170 },
    dob: { x: 80, y: 150 },
    birthTime: { x: 80, y: 130 },
  };

  // Text placed inside template boxes
  page.drawText(userData.name || "", {
    x: layout.name.x,
    y: layout.name.y,
    size: 14,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText(userData.dob || "", {
    x: layout.dob.x,
    y: layout.dob.y,
    size: 14,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText(userData.birthTime || "", {
    x: layout.birthTime.x,
    y: layout.birthTime.y,
    size: 14,
    font,
    color: rgb(0, 0, 0),
  });
}

// LAST PAGE (image only)
async function createLastPage(pdfDoc, bgBytes) {
  const page = pdfDoc.addPage([595, 842]);

  const jpgBuffer = await toJpg(bgBytes);
  const bgImage = await pdfDoc.embedJpg(jpgBuffer);

  const { width, height } = page.getSize();

  page.drawImage(bgImage, {
    x: 0,
    y: 0,
    width,
    height,
  });
}

export async function processReportPDF(jobData) {
  console.log("PROCESSING REPORT PDF...");

  const { reportOrderId, sourceUrl, frontBgUrl, lastBgUrl, userData } =
    jobData || {};

  console.log("processReportPDF job data:", {
    reportOrderId,
    sourceUrl,
    frontBgUrl,
    lastBgUrl,
    userData,
  });

  if (!reportOrderId || !sourceUrl) {
    throw new ApiError(400, "Invalid job data for processReportPDF");
  }

  // Load PDF
  const pdfBytes = await loadFile(sourceUrl);
  const inputPdf = await PDFDocument.load(pdfBytes);

  const outputPdf = await PDFDocument.create();

  const totalPages = inputPdf.getPageCount();

  // Copy middle pages (skip first & last) if present
  const pagesToCopy = [];
  for (let i = 1; i < Math.max(1, totalPages - 1); i++) {
    pagesToCopy.push(i);
  }

  const copiedPages =
    pagesToCopy.length > 0
      ? await outputPdf.copyPages(inputPdf, pagesToCopy)
      : [];

  // FRONT PAGE
  const frontBg = frontBgUrl ? await loadFile(frontBgUrl) : null;
  if (frontBg) await createFrontPage(outputPdf, frontBg, userData || {});

  // MIDDLE PAGES
  copiedPages.forEach((page) => outputPdf.addPage(page));

  // LAST PAGE
  const lastBg = lastBgUrl ? await loadFile(lastBgUrl) : null;
  if (lastBg) await createLastPage(outputPdf, lastBg);

  // SAVE
  const finalBytes = await outputPdf.save();

  // Upload the PDF to S3
  const uploaded = await uploadFile({
    file: {
      buffer: finalBytes,
      mimetype: "application/pdf",
      originalname: `report-${reportOrderId}.pdf`,
    },
  });

  if (!uploaded || !uploaded.url) {
    throw new ApiError(500, "Failed to upload processed PDF");
  }

  // Update ReportOrder with processed URL
  await ReportOrder.findByIdAndUpdate(reportOrderId, {
    reportUrl: uploaded.url,
    reportStatus: "completed",
  });

  console.log("PDF processed and uploaded:", uploaded.url);

  return uploaded.url;
}
