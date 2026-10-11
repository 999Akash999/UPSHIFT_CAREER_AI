const express = require("express");
const router = express.Router();
const roadmapController = require("../controllers/roadmapController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");
const { aiLimiter } = require("../middlewares/rateLimiter");

router.use(requireAuth, requireStudent);

router.get("/", roadmapController.getRoadmap);
router.post("/generate", aiLimiter, roadmapController.createRoadmap);
router.patch("/:roadmapId/week/:weekNumber/milestone/:milestoneIndex", roadmapController.toggleMilestone);

module.exports = router;