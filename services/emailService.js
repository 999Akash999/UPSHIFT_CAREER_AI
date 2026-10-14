const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendSystemEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[EMAIL SIMULATED to ${to}]: ${subject}`);
    return;
  }

  try {
    return await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"UPSHIFT CAREER" <no-reply@upshiftcareer.com>',
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("❌ Email Delivery Error:", err.message);
  }
};

const sendContactQueryEmail = async ({ name, email, subject, message }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP is not configured for contact query delivery.");
  }

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || '"UPSHIFT CAREER" <no-reply@upshiftcareer.com>',
    to: process.env.SUPPORT_EMAIL || "unshiftcareerai999@gmail.com",
    replyTo: email,
    subject: `[UPSHIFT Support] ${subject}`,
    text: `New support query from ${name} <${email}>\n\n${message}`,
    html: `<h2>New UPSHIFT support query</h2><p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p><p><strong>Subject:</strong> ${escapeHtml(subject)}</p><hr><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
  });
};

module.exports = { sendSystemEmail, sendContactQueryEmail };
