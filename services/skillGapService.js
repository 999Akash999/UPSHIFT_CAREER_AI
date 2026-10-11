const Job = require("../models/Job");
const Course = require("../models/Course");
const SkillAssessment = require("../models/SkillAssessment");

const roleSkillSets = {
  fullStack: ["HTML", "CSS", "JavaScript", "React", "Node.js", "Express", "APIs", "Databases", "Algorithms", "Testing", "Security", "Deployment", "System Design"],
  frontend: ["HTML", "CSS", "JavaScript", "React", "Accessibility", "APIs", "Testing", "Performance"],
  backend: ["JavaScript", "Node.js", "Express", "APIs", "Databases", "Authentication", "Security", "Testing", "Algorithms", "Deployment", "System Design"],
  data: ["Python", "Databases", "Algorithms", "Statistics", "APIs", "Testing", "Deployment"],
  java: ["Java", "Algorithms", "Databases", "APIs", "Testing", "Security", "System Design"],
};

const getTargetRoleSkills = (targetRole = "") => {
  const role = String(targetRole).toLowerCase();
  if (/front.?end|ui engineer|web designer/.test(role)) return roleSkillSets.frontend;
  if (/back.?end|server.?side/.test(role)) return roleSkillSets.backend;
  if (/data scientist|data engineer|machine learning|ml engineer/.test(role)) return roleSkillSets.data;
  if (/java/.test(role)) return roleSkillSets.java;
  if (/full.?stack|software engineer|web developer/.test(role)) return roleSkillSets.fullStack;
  const detected = Object.keys(roleSkillSets).find((key) => roleSkillSets[key].some((skill) => role.includes(skill.toLowerCase())));
  return detected ? roleSkillSets[detected] : roleSkillSets.fullStack;
};

const getRoleSkillProgress = async (userId, targetRole = "Full Stack Developer") => {
  const attempts = await SkillAssessment.find({ student: userId })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("assessment", "domain title");
  const scoreMap = new Map();

  for (const attempt of attempts) {
    const domain = attempt.assessment?.domain || attempt.assessment?.title || "";
    const groups = new Map();
    for (const answer of attempt.detailedAnswers || []) {
      const skill = answer.skill || (domain === "Web UI" ? "HTML & CSS" : domain);
      const group = groups.get(skill) || { total: 0, correct: 0 };
      group.total += 1;
      if (answer.isCorrect) group.correct += 1;
      groups.set(skill, group);
    }
    for (const [skill, group] of groups) {
      if (!group.total) continue;
      const score = Math.round((group.correct / group.total) * 100);
      const keys = skill === "HTML & CSS" ? ["HTML", "CSS"] : [skill];
      for (const key of keys) {
        const current = scoreMap.get(key) || { bestScore: null, latestScore: null, attempts: 0, lastAttemptAt: attempt.createdAt };
        current.attempts += 1;
        if (current.bestScore === null || score > current.bestScore) current.bestScore = score;
        if (current.latestScore === null) current.latestScore = score;
        scoreMap.set(key, current);
      }
    }
  }

  return getTargetRoleSkills(targetRole).map((skill) => {
    const result = scoreMap.get(skill) || { bestScore: null, latestScore: null, attempts: 0, lastAttemptAt: null };
    const score = result.bestScore;
    const status = score === null ? "Not tested" : score >= 75 ? "Strong" : score >= 60 ? "Developing" : "Needs improvement";
    return { skill, score, latestScore: result.latestScore, attempts: result.attempts, lastAttemptAt: result.lastAttemptAt, status, improvementNeeded: score === null || score < 75 };
  });
};

const evaluateGapsAndRecommendations = async (studentSkills = [], targetRole = "Software Engineer") => {
  const safeRole = String(targetRole || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const relevantJobs = safeRole
    ? await Job.find({ title: { $regex: safeRole, $options: "i" }, status: "active" })
      .limit(100).select("title requiredSkills").lean()
    : [];

  const demandMap = new Map();
  relevantJobs.forEach((job) => {
    (job.requiredSkills || []).forEach((skill) => {
      const label = String(skill || "").trim();
      const normalized = label.toLowerCase();
      if (!normalized) return;
      const current = demandMap.get(normalized) || { skill: label, jobCount: 0 };
      current.jobCount += 1;
      demandMap.set(normalized, current);
    });
  });

  const normalizedUserSkills = new Set(studentSkills.map((skill) => String(skill || "").toLowerCase().trim()).filter(Boolean));
  const marketSkills = [...demandMap.values()].sort((a, b) => b.jobCount - a.jobCount || a.skill.localeCompare(b.skill));
  const missingSkills = marketSkills.filter(({ skill }) => !normalizedUserSkills.has(skill.toLowerCase()));

  const topGaps = missingSkills.slice(0, 5).map((item) => item.skill);

  // Match platform upskilling courses
  const matchedCourses = await Course.find({
    targetSkillGaps: { $in: topGaps.map((skill) => new RegExp(`^${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")) },
    isPublished: true,
  }).select("title slug price discountPrice thumbnail");

  return {
    topGaps,
    marketDemandMap: Object.fromEntries(marketSkills.map(({ skill, jobCount }) => [skill.toLowerCase(), jobCount])),
    marketSkills,
    jobsAnalyzed: relevantJobs.length,
    recommendedCourses: matchedCourses,
  };
};

module.exports = { evaluateGapsAndRecommendations, getTargetRoleSkills, getRoleSkillProgress };
