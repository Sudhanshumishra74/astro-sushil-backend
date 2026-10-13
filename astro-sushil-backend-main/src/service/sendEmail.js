import nodemailer from "nodemailer";
import { ApiError } from "../utils/ApiError.js";
import { emailTemplates } from "../utils/emailTemplates.js";

// Prefixed with _ so local variables inside functions cannot accidentally shadow it.
let _transporter = null;

const createTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } =
    process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_SECURE) {
    throw new ApiError(500, "SMTP environment variables are not configured");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    pool: true,          // reuse connections instead of opening a new one per message
    maxConnections: 5,
    maxMessages: 100,
    socketTimeout: 30000,
  });
};

const getTransporter = () => {
  if (!_transporter) {
    _transporter = createTransporter();
  }
  return _transporter;
};

const sendEmail = async (options) => {
  const t = getTransporter(); // 't' avoids shadowing the module-level _transporter

  let subject = options.subject;
  let html = options.html;

  if (options.template) {
    const templateFn = emailTemplates[options.template];

    if (!templateFn) {
      throw new ApiError(400, `Template ${options.template} not found`);
    }

    const templateData = templateFn(options.data || {});

    subject = templateData.subject;
    html = templateData.html;
  }

  const mailOptions = {
    from: {
      name: "Astro Sushil",
      address: process.env.SMTP_FROM || process.env.SMTP_USER,
    },
    to: options.to || options.email,
    subject,
    html,
    text: options.message || undefined,
    cc: options.cc || undefined,
    bcc: options.bcc || undefined,
    replyTo: options.replyTo || undefined,
    attachments: options.attachments || undefined,
  };

  try {
    const info = await t.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    // Reset singleton so the next call creates a fresh connection instead of
    // retrying with a potentially broken transporter.
    _transporter = null;
    throw new ApiError(500, "Email sending failed", [error.message]);
  }
};

export const contactAdminTemplate = ({
  name,
  email,
  phone,
  subject,
  message,
}) => ({
  subject: "New Contact Form Submission",
  html: `
    <div style="font-family: Arial; padding: 20px;">
      <h2>New Contact Request</h2>
      <p><b>Name:</b> ${name}</p>
      <p><b>Email:</b> ${email}</p>
      <p><b>Phone:</b> ${phone || "-"}</p>
      <p><b>Subject:</b> ${subject || "-"}</p>
      <p><b>Message:</b><br/> ${message}</p>
    </div>
  `,
});

export const contactUserTemplate = ({ name, message }) => ({
  subject: "We received your request",
  html: `
    <div style="font-family: Arial; padding: 20px;">
      <h2>Hi ${name},</h2>
      <p>Thanks for contacting us. We have received your message.</p>
      <p>Our team will get back to you shortly.</p>
      <br/>
      <p><b>Your Message:</b></p>
      <p>${message}</p>
    </div>
  `,
});
export default sendEmail;
