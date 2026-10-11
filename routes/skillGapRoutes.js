// routes/skillGapRoutes.js
const express = require("express");
const router = express.Router();
const skillGapController = require("../controllers/skillGapController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");
const workspaceController = require("../controllers/studentWorkspaceController");

router.use(requireAuth, requireStudent);

router.get("/", workspaceController.getSkillGap);
router.post("/analyze", skillGapController.analyzeSkillGap);

module.exports = router;
