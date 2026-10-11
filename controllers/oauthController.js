const User = require("../models/User");
const OAuthAccount = require("../models/OAuthAccount");

exports.handleCallback = async (req, res) => {
  try {
    if (!req.user) {
      req.flash("error", "Authentication failed. Please try again.");
      return res.redirect("/login");
    }

    // New student profile onboarding check
    if (req.user.role === "student" && !req.user.isOnboarded) {
      return res.redirect("/onboarding/welcome");
    }

    req.flash("success", `Signed in successfully as ${req.user.name}`);
    res.redirect(`/${req.user.role}/dashboard`);
  } catch (err) {
    console.error("OAuth Callback Error:", err);
    req.flash("error", "Failed to finalize social authentication.");
    res.redirect("/login");
  }
};

exports.unlinkProvider = async (req, res) => {
  try {
    const { provider } = req.params;
    const count = await OAuthAccount.countDocuments({ user: req.user._id });
    
    // Guard against lockout if no local password is set
    const user = await User.findById(req.user._id);
    if (!user.hash && count <= 1) {
      req.flash("error", "Cannot unlink only login method. Please set a password first.");
      return res.redirect("/student/settings");
    }

    await OAuthAccount.findOneAndDelete({ user: req.user._id, provider });
    req.flash("success", `${provider} account unlinked successfully.`);
    res.redirect("/student/settings");
  } catch (err) {
    req.flash("error", "Failed to unlink provider.");
    res.redirect("/student/settings");
  }
};
