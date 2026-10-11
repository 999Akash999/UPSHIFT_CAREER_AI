// routes/employabilityRoutes.js
const express = require("express");
const router = express.Router();
const employabilityController = require("../controllers/employabilityController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");

router.use(requireAuth, requireStudent);

router.get("/", async (req, res, next) => {
  try {
    const EmployabilitySnapshot = require("../models/EmployabilitySnapshot");
    const InterviewSession = require("../models/InterviewSession");
    const [snapshot, latestInterview] = await Promise.all([
      EmployabilitySnapshot.findOne({ student: req.student._id }).sort({ createdAt: -1 }),
      InterviewSession.findOne({ student: req.user._id, status: "completed", finalScore: { $ne: null } })
        .sort({ updatedAt: -1 }).select("roleType finalScore updatedAt"),
    ]);
    res.render("student/employability", { title: "Employability Score", snapshot, latestInterview });
  } catch (error) {
    next(error);
  }
});
router.post("/recalculate", employabilityController.calculateCompositeScore);

module.exports = router;
