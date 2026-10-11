// routes/skillGapRoutes.js
const express = require("express");
const router = express.Router();
const skillGapController = require("../controllers/skillGapController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");

router.use(requireAuth, requireStudent);

router.get("/", async (req, res, next) => {
  try {
    const Student = require("../models/Student");
    const student = await Student.findById(req.student._id);
    res.render("student/skill-gap", { title: "Skill Gap Analysis", student, topGaps: student.identifiedGaps || [] });
  } catch (error) {
    next(error);
  }
});
router.post("/analyze", skillGapController.analyzeSkillGap);

module.exports = router;
