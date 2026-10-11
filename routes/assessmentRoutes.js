// routes/assessmentRoutes.js
const express = require("express");
const router = express.Router();
const assessmentController = require("../controllers/assessmentController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");
const workspaceController = require("../controllers/studentWorkspaceController");
const { apiLimiter } = require("../middlewares/rateLimiter");

router.use(requireAuth, requireStudent);

router.get("/", workspaceController.getAssessments);
router.get("/:id", assessmentController.getAssessment);
router.post("/submit", apiLimiter, assessmentController.submitAssessment);

module.exports = router;
