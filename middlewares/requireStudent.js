const Student = require("../models/Student");

module.exports = async (req, res, next) => {
  const wantsJson = req.xhr || req.headers.accept?.includes("application/json");
  if (!req.user) {
    if (req.session) req.session.returnTo = req.originalUrl;
    if (wantsJson) return res.status(401).json({ success: false, error: "Please sign in again to open this lesson." });
    return res.redirect("/login");
  }

  if (req.user.role !== "student") {
    if (wantsJson) return res.status(403).json({ success: false, error: "This learning content is available to student accounts." });
    req.flash("error", "Access restricted to student accounts.");
    return res.redirect(`/${req.user.role}/dashboard`);
  }

  // Redirect to onboarding if profile setup is incomplete
  if (!req.user.isOnboarded && !req.path.startsWith("/onboarding")) {
    if (wantsJson) return res.status(403).json({ success: false, error: "Complete your student profile before opening this lesson." });
    req.flash("info", "Please complete your career profile setup first.");
    return res.redirect("/onboarding/welcome");
  }

  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      if (wantsJson) return res.status(404).json({ success: false, error: "Student profile not found." });
      req.flash("error", "Student profile record missing. Please re-run setup.");
      return res.redirect("/onboarding/welcome");
    }
    req.student = student;
    next();
  } catch (err) {
    next(err);
  }
};
