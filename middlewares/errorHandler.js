module.exports = (err, req, res, next) => {
  console.error("🔥 Error caught by errorHandler middleware:", err);
  if (res.headersSent) return next(err);

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "An unexpected system error occurred.";

  // 1. Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `An entry with this ${field} already exists.`;
  }

  // 2. Mongoose Schema Validation Error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(". ");
  }

  if (err.name === "CastError") {
    statusCode = 400;
    message = "The requested identifier is invalid.";
  }

  // 3. Multer Upload Size/Type Errors
  if (err.name === "MulterError") {
    statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File is too large. Maximum allowed size is 5MB.";
    }
  }

  // API / AJAX Response Handler
  if (req.xhr || req.headers.accept?.indexOf("json") > -1 || req.path.startsWith("/api/")) {
    return res.status(statusCode).json({
      success: false,
      error: message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }

  // EJS Render Handler
  if (statusCode === 404) {
    return res.status(404).render("errors/404", {
      title: "404 - Page Not Found",
      message: "The requested page does not exist.",
    });
  }

  if (statusCode === 403) {
    return res.status(403).render("errors/403", {
      title: "403 - Forbidden",
      message,
    });
  }

  res.status(statusCode).render("errors/500", {
    title: "500 - Server Error",
    message: process.env.NODE_ENV === "production" ? "Something went wrong on our end." : message,
    // The 500 template checks `error.stack`; passing this as `stack` silently
    // hid the actual exception and made route failures impossible to diagnose.
    error: process.env.NODE_ENV !== "production" ? err : null,
  });
};
