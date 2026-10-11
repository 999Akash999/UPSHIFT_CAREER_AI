const crypto = require("crypto");
const User = require("../models/User");
const Student = require("../models/Student");
const RecruiterProfile = require("../models/RecruiterProfile");
const MentorProfile = require("../models/MentorProfile");
const AlumniProfile = require("../models/AlumniProfile");
const EmailVerification = require("../models/EmailVerification");
const PasswordReset = require("../models/PasswordReset");
const { sendSystemEmail } = require("../services/emailService");

const appBaseUrl = () => (process.env.APP_BASE_URL || "http://localhost:5000").replace(/\/$/, "");

exports.renderVerifyEmail = (req, res) => {
  res.render("auth/verify-email", { title: "Verify your email" });
};

exports.verifyEmail = async (req, res) => {
  const record = await EmailVerification.findOne({ token: req.params.token, expiresAt: { $gt: new Date() } });
  if (!record) {
    req.flash("error", "This verification link is invalid or expired.");
    return res.redirect("/verify-email");
  }
  await User.findByIdAndUpdate(record.user, { isEmailVerified: true });
  await EmailVerification.deleteMany({ user: record.user });
  req.flash("success", "Email verified successfully.");
  res.redirect(req.isAuthenticated() ? "/student/dashboard" : "/login");
};

exports.resendVerification = async (req, res) => {
  if (!req.user) return res.redirect("/login");
  if (req.user.isEmailVerified) {
    req.flash("info", "Your email is already verified.");
    return res.redirect("/student/dashboard");
  }
  const token = crypto.randomBytes(32).toString("hex");
  await EmailVerification.deleteMany({ user: req.user._id });
  await EmailVerification.create({ user: req.user._id, token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  const verificationUrl = `${appBaseUrl()}/verify-email/${token}`;
  await sendSystemEmail({
    to: req.user.email,
    subject: "Verify your UPSHIFT CAREER email",
    html: `<p>Confirm your email address:</p><p><a href="${verificationUrl}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
  });
  req.flash("success", "A verification link has been sent if email delivery is configured.");
  res.redirect("/verify-email");
};

// Render Login Page
exports.renderLogin = (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect(`/${req.user.role}/dashboard`);
  }
  res.render("auth/login", { title: "Login | UPSHIFT CAREER" });
};

// Handle Local Login
exports.login = (req, res) => {
  req.flash("success", `Welcome back, ${req.user.name}!`);
  
  // If student hasn't completed onboarding, direct them there
  if (req.user.role === "student" && !req.user.isOnboarded) {
    return res.redirect("/onboarding/welcome");
  }
  
  const redirectUrl = req.session.returnTo || `/${req.user.role}/dashboard`;
  delete req.session.returnTo;
  res.redirect(redirectUrl);
};

// Render Signup Page
exports.renderSignup = (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect(`/${req.user.role}/dashboard`);
  }
  res.render("auth/signup", { title: "Join UPSHIFT CAREER" });
};

// Handle Signup & Initialize Role Profile
exports.signup = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!String(name || "").trim() || !String(email || "").trim() || !password) {
      req.flash("error", "Name, email, and password are required.");
      return res.redirect("/signup");
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      req.flash("error", "An account with this email already exists.");
      return res.redirect("/signup");
    }

    const validRoles = ["student", "recruiter", "mentor", "alumni"];
    const assignedRole = validRoles.includes(role) ? role : "student";

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role: assignedRole,
      isOnboarded: false,
      isEmailVerified: false,
    });

    // Hash password via Mongoose pre-save or passport-local-mongoose
    await User.register(user, password);

    // Initialize matching role profile
    if (assignedRole === "student") {
      await Student.create({ user: user._id, skills: [], targetRole: "" });
    } else if (assignedRole === "recruiter") {
      await RecruiterProfile.create({ user: user._id, hiringDomains: [] });
    } else if (assignedRole === "mentor") {
      await MentorProfile.create({ user: user._id, expertise: [], hourlyRate: 0 });
    } else if (assignedRole === "alumni") {
      await AlumniProfile.create({ user: user._id, graduationBatch: new Date().getFullYear(), willingToRefer: true });
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    await EmailVerification.create({
      user: user._id,
      token: verificationToken,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000), // 24 hours
    });

    const verificationUrl = `${appBaseUrl()}/verify-email/${verificationToken}`;
    await sendSystemEmail({
      to: user.email,
      subject: "Verify your UPSHIFT CAREER email",
      html: `<p>Welcome to UPSHIFT CAREER. Confirm your email address:</p><p><a href="${verificationUrl}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
    });

    // Auto-login post registration
    req.login(user, (err) => {
      if (err) return next(err);
      req.flash("success", "Account created. Verify your email, then complete your profile.");
      if (!user.isEmailVerified) return res.redirect("/verify-email");
      if (user.role === "student") {
        return res.redirect("/onboarding/welcome");
      }
      res.redirect(`/${user.role}/dashboard`);
    });
  } catch (err) {
    req.flash("error", err.message || "Failed to create account.");
    res.redirect("/signup");
  }
};

// Handle Logout
exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "You have been logged out securely.");
    res.redirect("/login");
  });
};

// Render Forgot Password
exports.renderForgotPassword = (req, res) => {
  res.render("auth/forgot-password", { title: "Reset Password" });
};

// Handle Forgot Password Request
exports.sendResetPasswordLink = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      req.flash("info", "If an account with that email exists, a password reset link has been sent.");
      return res.redirect("/forgot-password");
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    await PasswordReset.create({
      user: user._id,
      token: resetToken,
      expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
    });

    const resetUrl = `${appBaseUrl()}/reset-password/${resetToken}`;
    await sendSystemEmail({
      to: user.email,
      subject: "Reset your UPSHIFT CAREER password",
      html: `<p>Use the link below to reset your password:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in one hour. If you did not request it, ignore this email.</p>`,
    });

    req.flash("info", "If an account with that email exists, a password reset link has been sent.");
    res.redirect("/forgot-password");
  } catch (err) {
    req.flash("error", "Error initiating password reset.");
    res.redirect("/forgot-password");
  }
};

// Render Reset Password Form
exports.renderResetPassword = async (req, res) => {
  const { token } = req.params;
  const resetRecord = await PasswordReset.findOne({
    token,
    expiresAt: { $gt: Date.now() },
  });

  if (!resetRecord) {
    req.flash("error", "Password reset token is invalid or has expired.");
    return res.redirect("/forgot-password");
  }

  res.render("auth/reset-password", { token, title: "Set New Password" });
};

// Execute Password Reset
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      req.flash("error", "Passwords do not match.");
      return res.redirect(`/reset-password/${token}`);
    }

    const resetRecord = await PasswordReset.findOne({
      token,
      expiresAt: { $gt: Date.now() },
    });

    if (!resetRecord) {
      req.flash("error", "Token expired or invalid.");
      return res.redirect("/forgot-password");
    }

    const user = await User.findById(resetRecord.user);
    await user.setPassword(password);
    await user.save();

    await PasswordReset.deleteMany({ user: user._id });

    req.flash("success", "Password updated successfully. Please log in.");
    res.redirect("/login");
  } catch (err) {
    req.flash("error", "Failed to reset password.");
    res.redirect("/forgot-password");
  }
};
