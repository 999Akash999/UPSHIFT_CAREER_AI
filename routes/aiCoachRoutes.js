// routes/aiCoachRoutes.js
const express = require("express");
const router = express.Router();
const aiCoachController = require("../controllers/aiCoachController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");
const { aiLimiter } = require("../middlewares/rateLimiter");

router.use(requireAuth, requireStudent);

router.post("/advice", aiLimiter, aiCoachController.getAdvice);

module.exports = router;