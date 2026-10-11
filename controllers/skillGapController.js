const Student = require("../models/Student");
const { evaluateGapsAndRecommendations } = require("../services/skillGapService");

exports.analyzeSkillGap = async (req, res) => {
  try {
    const student = req.student || await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ error: "Student profile not found." });
    const role = String(req.body?.targetJobTitle || student.targetRole || "").trim().slice(0, 100);
    const analysis = await evaluateGapsAndRecommendations(student.skills || [], role);
    student.identifiedGaps = analysis.topGaps;
    await student.save();

    res.json({
      success: true,
      currentSkills: student.skills,
      targetRole: role,
      jobsAnalyzed: analysis.jobsAnalyzed,
      marketSkills: analysis.marketSkills,
      marketDemand: analysis.marketDemandMap,
      gaps: analysis.topGaps,
      recommendedCourses: analysis.recommendedCourses,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not evaluate skill delta." });
  }
};
