// routes/interviewRoutes.js
const express = require("express");
const router = express.Router();
const interviewController = require("../controllers/interviewController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");
const { aiLimiter, apiLimiter } = require("../middlewares/rateLimiter");

router.use(requireAuth, requireStudent);

router.post("/start", apiLimiter, interviewController.startMockInterview);
router.post("/devices", apiLimiter, interviewController.verifyDevices);
router.post("/event", apiLimiter, interviewController.recordProctoringEvent);
router.post("/answer", aiLimiter, interviewController.submitAnswer);

module.exports = router;
