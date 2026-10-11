const Job = require("../models/Job");
const EmployabilitySnapshot = require("../models/EmployabilitySnapshot");
const Student = require("../models/Student");

exports.listJobs = async (req, res) => {
  const { role, location, minScore } = req.query;
  const filter = { status: "active" };

  if (role) filter.title = new RegExp(String(role).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (location) filter.location = new RegExp(String(location).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (minScore) filter.minScoreCutoff = { $lte: parseInt(minScore, 10) };

  const jobs = await Job.find(filter).populate("company").lean();
  let currentScore = 0;
  if (req.user) {
    const student = await Student.findOne({ user: req.user._id });
    if (student) {
      const snapshot = await EmployabilitySnapshot.findOne({ student: student._id }).sort({ createdAt: -1 });
      currentScore = snapshot?.overallScore || 0;
    }
  }
  for (const job of jobs) {
    job.minEmployabilityScore = job.minScoreCutoff;
    job.jobType = job.type;
  }
  res.render("student/jobs", { title: "Find Jobs", jobs, query: req.query, currentScore });
};
