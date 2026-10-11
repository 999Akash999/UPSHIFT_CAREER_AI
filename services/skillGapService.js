const Job = require("../models/Job");
const Course = require("../models/Course");

const evaluateGapsAndRecommendations = async (studentSkills = [], targetRole = "Software Engineer") => {
  const relevantJobs = await Job.find({
    title: { $regex: targetRole, $options: "i" },
    status: "active",
  }).limit(50);

  const demandMap = {};
  relevantJobs.forEach((job) => {
    (job.requiredSkills || []).forEach((skill) => {
      const normalized = skill.toLowerCase().trim();
      demandMap[normalized] = (demandMap[normalized] || 0) + 1;
    });
  });

  const normalizedUserSkills = studentSkills.map((s) => s.toLowerCase().trim());
  const missingSkills = Object.keys(demandMap).filter((skill) => !normalizedUserSkills.includes(skill));

  // Top missing in-demand skills
  const topGaps = missingSkills.sort((a, b) => demandMap[b] - demandMap[a]).slice(0, 5);

  // Match platform upskilling courses
  const matchedCourses = await Course.find({
    targetSkillGaps: { $in: topGaps },
    isPublished: true,
  }).select("title slug price discountPrice thumbnail");

  return {
    topGaps,
    marketDemandMap: demandMap,
    recommendedCourses: matchedCourses,
  };
};

module.exports = { evaluateGapsAndRecommendations };