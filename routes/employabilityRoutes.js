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
    const snapshot = await EmployabilitySnapshot.findOne({ student: req.student._id }).sort({ createdAt: -1 });
    res.render("student/employability", { title: "Employability Score", snapshot });
  } catch (error) {
    next(error);
  }
});
router.post("/recalculate", employabilityController.calculateCompositeScore);

module.exports = router;
