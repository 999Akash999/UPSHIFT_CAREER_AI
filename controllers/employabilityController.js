const { calculateEmployability } = require("../services/employabilityService");

exports.calculateCompositeScore = async (req, res, next) => {
  try {
    const snapshot = await calculateEmployability(req.student._id);
    if (req.accepts("html")) {
      req.flash("success", "Employability score updated from your latest learning activity.");
      return res.redirect("/student/employability");
    }
    res.json({ success: true, snapshot });
  } catch (error) {
    next(error);
  }
};
