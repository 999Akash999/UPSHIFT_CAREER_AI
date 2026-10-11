const express = require("express");
const router = express.Router();
const alumniController = require("../controllers/alumniController");
const requireAuth = require("../middlewares/requireAuth");
const requireRole = require("../middlewares/requireRole");

// Directory is available to signed-in members; referral requests are student-only.
router.get("/directory", requireAuth, alumniController.getDirectory);
router.get("/", requireAuth, alumniController.getDirectory);
router.post("/referrals/request/:profileId", requireAuth, requireRole("student"), alumniController.requestReferral);
router.get("/dashboard", requireAuth, requireRole("alumni"), alumniController.getDashboard);
router.get("/my-events", requireAuth, requireRole("alumni"), alumniController.getMyEvents);
router.get("/referrals", requireAuth, requireRole("alumni"), alumniController.getReferrals);
router.get("/referrals/:referralId", requireAuth, requireRole("alumni"), (req, res) => res.redirect("/alumni/referrals"));
router.post("/referrals/:referralId/status", requireAuth, requireRole("alumni"), alumniController.updateReferralStatus);

// Alumni-only management routes
router.post("/events", requireAuth, requireRole("alumni"), alumniController.createEvent);

module.exports = router;
