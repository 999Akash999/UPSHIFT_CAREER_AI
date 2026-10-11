module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      if (req.session) req.session.returnTo = req.originalUrl;
      req.flash("error", "Please sign in first.");
      return res.redirect("/login");
    }

    if (allowedRoles.includes(req.user.role) || req.user.role === "admin") {
      return next();
    }

    if (req.xhr || req.headers.accept?.indexOf("json") > -1 || req.path.startsWith("/api/")) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not possess the required permissions for this action.",
      });
    }

    res.status(403).render("errors/403", {
      title: "403 Forbidden",
      message: "You are not authorized to view this resource.",
    });
  };
};