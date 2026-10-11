const SkillAssessment = require("../models/SkillAssessment");
const Assessment = require("../models/Assessment");

const getRecommendedDifficulty = async (studentId, domain) => {
  const safeDomain = String(domain || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!safeDomain) return null;
  const assessmentIds = await Assessment.find({ domain: new RegExp(`^${safeDomain}$`, "i") }).distinct("_id");
  if (!assessmentIds.length) return null;
  const validAttempts = await SkillAssessment.find({ student: studentId, assessment: { $in: assessmentIds } })
    .sort({ createdAt: -1 }).limit(3).select("score");
  if (!validAttempts.length) return null;

  const avgScore = validAttempts.reduce((acc, curr) => acc + curr.score, 0) / validAttempts.length;

  if (avgScore >= 80) return "Advanced";
  if (avgScore <= 50) return "Beginner";
  return "Intermediate";
};

module.exports = { getRecommendedDifficulty };
