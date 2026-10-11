const rateLimit = require("express-rate-limit");

// 1. Strict Limiter for Auth Routes (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again after 15 minutes.",
  },
  handler: (req, res, next, options) => {
    if (req.xhr || req.headers.accept?.indexOf("json") > -1) {
      return res.status(429).json(options.message);
    }
    req.flash("error", "Too many attempts. Please try again in 15 minutes.");
    res.redirect("/login");
  },
});

// 2. AI Service Rate Limiter (token expense control)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 12, // 12 queries per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "AI query capacity reached for this minute. Please wait a few seconds before asking again.",
  },
  handler: (req, res, next, options) => {
    if (req.xhr || req.headers.accept?.includes("json")) {
      return res.status(options.statusCode).json({ success: false, error: options.message.message });
    }
    req.flash("error", options.message.message);
    return res.redirect("/student/roadmap");
  },
});

// 3. General API limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Request limit exceeded. Please slow down.",
  },
});

module.exports = {
  authLimiter,
  aiLimiter,
  apiLimiter,
};
