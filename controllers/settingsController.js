    const User = require("../models/User");

exports.renderSettings = (req, res) => {
  res.render("student/settings", { user: req.user });
};

exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      req.flash("error", "Enter your current password and a new password with at least 8 characters.");
      return res.redirect("/student/settings");
    }
    const user = await User.findById(req.user._id);

    user.changePassword(currentPassword, newPassword, (err) => {
      if (err) {
        req.flash("error", "Incorrect current password.");
        return res.redirect("/student/settings");
      }
      req.flash("success", "Password updated successfully.");
      res.redirect("/student/settings");
    });
  } catch (err) {
    req.flash("error", "Failed to update security settings.");
    res.redirect("/student/settings");
  }
};
