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

module.exports = { sendSystemEmail };