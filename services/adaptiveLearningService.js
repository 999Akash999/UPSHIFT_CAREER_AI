const SkillAssessment = require("../models/SkillAssessment");

const getRecommendedDifficulty = async (studentId, domain) => {
  const history = await SkillAssessment.find({ student: studentId })
    .populate({
      path: "assessment",
      match: { domain: new RegExp(domain, "i") },
    })
    .sort({ createdAt: -1 })
    .limit(3);

  const validAttempts = history.filter((h) => h.assessment !== null);
  if (validAttempts.length === 0) return "Intermediate";

  const avgScore = validAttempts.reduce((acc, curr) => acc + curr.score, 0) / validAttempts.length;

  if (avgScore >= 80) return "Advanced";
  if (avgScore <= 50) return "Beginner";
  return "Intermediate";
};

module.exports = { getRecommendedDifficulty };