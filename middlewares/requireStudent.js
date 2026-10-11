const Student = require("../models/Student");

module.exports = async (req, res, next) => {
  if (!req.user) {
    if (req.session) req.session.returnTo = req.originalUrl;
    return res.redirect("/login");
  }

  if (req.user.role !== "student") {
    req.flash("error", "Access restricted to student accounts.");
    return res.redirect(`/${req.user.role}/dashboard`);
  }

  // Redirect to onboarding if profile setup is incomplete
  if (!req.user.isOnboarded && !req.path.startsWith("/onboarding")) {
    req.flash("info", "Please complete your career profile setup first.");
    return res.redirect("/onboarding/welcome");
  }

  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      req.flash("error", "Student profile record missing. Please re-run setup.");
      return res.redirect("/onboarding/welcome");
    }
    req.student = student;
    next();
  } catch (err) {
    next(err);
  }
};