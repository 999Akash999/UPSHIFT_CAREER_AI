const express = require("express");
const router = express.Router();
const passport = require("passport");
const authController = require("../controllers/authController");
const { authLimiter } = require("../middlewares/rateLimiter");
const requireAuth = require("../middlewares/requireAuth");

// Authentication views
router.get("/login", authController.renderLogin);
router.get("/signup", authController.renderSignup);
router.get("/verify-email", authController.renderVerifyEmail);
router.get("/verify-email/:token", authController.verifyEmail);
router.post("/auth/resend-verification", requireAuth, authController.resendVerification);
router.get("/logout", authController.logout);

// Local login with passport-local authentication strategy
router.post(
  "/login",
  authLimiter,
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  authController.login
);

// Account creation
router.post("/signup", authLimiter, authController.signup);

// Password recovery pipeline
router.get("/forgot-password", authController.renderForgotPassword);
router.post("/forgot-password", authLimiter, authController.sendResetPasswordLink);
router.get("/reset-password/:token", authController.renderResetPassword);
router.post("/reset-password/:token", authLimiter, authController.resetPassword);

module.exports = router;
