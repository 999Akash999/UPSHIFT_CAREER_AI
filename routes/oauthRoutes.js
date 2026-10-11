const express = require("express");
const router = express.Router();
const passport = require("passport");
const oauthController = require("../controllers/oauthController");
const requireAuth = require("../middlewares/requireAuth");

const providerEnabled = (provider) => (req, res, next) => {
  if (!passport._strategy(provider)) {
    req.flash("error", `${provider[0].toUpperCase()}${provider.slice(1)} sign-in is not configured yet.`);
    return res.redirect("/login");
  }
  next();
};

// 1. Google OAuth
router.get(
  "/google",
  providerEnabled("google"),
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  providerEnabled("google"),
  passport.authenticate("google", { failureRedirect: "/login", failureFlash: true }),
  oauthController.handleCallback
);

// 2. GitHub OAuth
router.get(
  "/github",
  providerEnabled("github"),
  passport.authenticate("github", { scope: ["user:email"] })
);
router.get(
  "/github/callback",
  providerEnabled("github"),
  passport.authenticate("github", { failureRedirect: "/login", failureFlash: true }),
  oauthController.handleCallback
);

// 3. LinkedIn OAuth
router.get(
  "/linkedin",
  providerEnabled("linkedin"),
  passport.authenticate("linkedin", { state: true })
);
router.get(
  "/linkedin/callback",
  providerEnabled("linkedin"),
  passport.authenticate("linkedin", { failureRedirect: "/login", failureFlash: true }),
  oauthController.handleCallback
);

// 4. Apple OAuth
router.get(
  "/apple",
  providerEnabled("apple"),
  passport.authenticate("apple")
);
router.post(
  "/apple/callback",
  providerEnabled("apple"),
  passport.authenticate("apple", { failureRedirect: "/login", failureFlash: true }),
  oauthController.handleCallback
);

// Account unlinking
router.delete("/unlink/:provider", requireAuth, oauthController.unlinkProvider);

module.exports = router;
