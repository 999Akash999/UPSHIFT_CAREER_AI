// routes/aiTutorRoutes.js
const express = require("express");
const router = express.Router();
const aiTutorController = require("../controllers/aiTutorController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");
const { aiLimiter } = require("../middlewares/rateLimiter");

router.use(requireAuth, requireStudent);

router.get("/", aiTutorController.renderChatUI);
router.post("/ask", aiLimiter, aiTutorController.askDoubt);

module.exports = router;