const Student = require("../models/Student");
const Job = require("../models/Job");

exports.analyzeSkillGap = async (req, res) => {
  try {
    const student = req.student || await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ error: "Student profile not found." });
    const { targetJobTitle } = req.body;

    // Aggregate required skills for target role across active postings
    const role = String(targetJobTitle || student.targetRole || "").trim();
    const safeRole = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchingJobs = role ? await Job.find({
      title: new RegExp(safeRole, "i"),
      status: "active",
    }) : [];

    const marketSkillFreq = {};
    matchingJobs.forEach((job) => {
      job.requiredSkills.forEach((skill) => {
        const normalized = skill.toLowerCase().trim();
        marketSkillFreq[normalized] = (marketSkillFreq[normalized] || 0) + 1;
      });
    });

    const studentSkillsLower = (student.skills || []).map((s) => s.toLowerCase().trim());
    const missingSkills = Object.keys(marketSkillFreq).filter(
      (skill) => !studentSkillsLower.includes(skill)
    );

    student.identifiedGaps = missingSkills;
    await student.save();

    res.json({
      success: true,
      currentSkills: student.skills,
      marketDemand: marketSkillFreq,
      gaps: missingSkills,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not evaluate skill delta." });
  }
};
