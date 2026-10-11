const { EMPLOYABILITY_WEIGHTS } = require("./constants");

/**
 * Calculates a weighted composite employability score (0-100).
 *
 * @param {Object} metrics
 * @param {number} [metrics.assessments=0] - Assessment average (0-100)
 * @param {number} [metrics.projects=0] - Portfolio projects rating (0-100)
 * @param {number} [metrics.roadmap=0] - Milestone completion percentage (0-100)
 * @param {number} [metrics.interviews=0] - Mock interview evaluation score (0-100)
 * @returns {Object} { overallScore, breakdown, grade }
 */
const calculateEmployabilityScore = ({
  assessments = 0,
  projects = 0,
  roadmap = 0,
  interviews = 0,
} = {}) => {
  const clamp = (val) => Math.min(100, Math.max(0, Number(val) || 0));

  const technical = clamp(assessments);
  const projectScore = clamp(projects);
  const roadmapProgress = clamp(roadmap);
  const softSkills = clamp(interviews);

  const weightedTotal =
    technical * EMPLOYABILITY_WEIGHTS.ASSESSMENTS +
    projectScore * EMPLOYABILITY_WEIGHTS.PROJECTS +
    roadmapProgress * EMPLOYABILITY_WEIGHTS.ROADMAP_PROGRESS +
    softSkills * EMPLOYABILITY_WEIGHTS.INTERVIEWS;

  const overallScore = Math.round(weightedTotal);

  let grade = "Bronze";
  if (overallScore >= 85) grade = "Diamond";
  else if (overallScore >= 70) grade = "Gold";
  else if (overallScore >= 55) grade = "Silver";

  return {
    overallScore,
    breakdown: {
      technical,
      projects: projectScore,
      roadmapProgress,
      softSkills,
      problemSolving: Math.round((technical + projectScore) / 2),
    },
    grade,
  };
};

module.exports = calculateEmployabilityScore;