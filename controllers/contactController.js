const { sendContactQueryEmail } = require("../services/emailService");

const cleanText = (value, maxLength) => (typeof value === "string" ? value.trim().slice(0, maxLength) : "");

exports.submitQuery = async (req, res) => {
  const name = cleanText(req.body?.name, 100);
  const email = cleanText(req.body?.email, 254).toLowerCase();
  const subject = cleanText(req.body?.subject, 160);
  const message = cleanText(req.body?.message, 5000);
  const honeypot = cleanText(req.body?.website, 200);
  const redirectTo = req.body?.source === "help" ? "/help" : "/contact";

  // Quietly discard automated submissions that fill the hidden honeypot field.
  if (honeypot) {
    req.flash("success", "Thanks. Your query has been sent to the UPSHIFT team.");
    return res.redirect(redirectTo);
  }

  if (!name || !email || !subject || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    req.flash("error", "Please enter your name, a valid email, a subject, and your query.");
    return res.redirect(redirectTo);
  }

  try {
    await sendContactQueryEmail({ name, email, subject, message });
    req.flash("success", "Your query has been sent. The UPSHIFT team will get back to you.");
  } catch (error) {
    console.error("Contact query email could not be delivered:", error.message);
    req.flash("error", "We could not send your query right now. Please try again later or email support directly.");
  }

  res.redirect(redirectTo);
};
