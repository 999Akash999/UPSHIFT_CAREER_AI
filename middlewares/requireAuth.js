module.exports = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  // Preserve intended destination for HTML requests
  if (req.session) {
    req.session.returnTo = req.originalUrl;
  }

  // Check if API endpoint or standard page visit
  if (req.xhr || req.headers.accept?.indexOf("json") > -1 || req.path.startsWith("/api/")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to access this resource.",
    });
  }

  req.flash("error", "You must be signed in to access this page.");
  return res.redirect("/login");
};