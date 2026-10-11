module.exports = (schema, source = "body") => {
  return (req, res, next) => {
    if (!schema) return next();

    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessages = error.details.map((d) => d.message.replace(/['"]/g, ""));

      if (req.xhr || req.headers.accept?.indexOf("json") > -1 || req.path.startsWith("/api/")) {
        return res.status(400).json({
          success: false,
          errors: errorMessages,
        });
      }

      req.flash("error", errorMessages.join(". "));
      return res.redirect("back");
    }

    // Replace unvalidated payload with sanitized and cast value
    req[source] = value;
    next();
  };
};