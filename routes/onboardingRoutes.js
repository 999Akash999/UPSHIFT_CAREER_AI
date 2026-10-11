const express = require("express");
const router = express.Router();
const onboardingController = require("../controllers/onboardingController");
const requireAuth = require("../middlewares/requireAuth");
const requireRole = require("../middlewares/requireRole");

router.use(requireAuth);
router.use(requireRole("student"));

router.get("/:step", onboardingController.renderStep);
router.post("/education", onboardingController.saveEducation);
router.post("/skills", onboardingController.saveSkills);
router.post("/career-goal", onboardingController.completeOnboarding);

module.exports = router;