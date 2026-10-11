const MentorProfile = require("../models/MentorProfile");

const calculateCosineSimilarity = (tagsA = [], tagsB = []) => {
  const setA = new Set(tagsA.map((t) => t.toLowerCase()));
  const setB = new Set(tagsB.map((t) => t.toLowerCase()));
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const magnitude = Math.sqrt(setA.size) * Math.sqrt(setB.size);
  return magnitude ? intersection / magnitude : 0;
};

const getRecommendedMentors = async (studentSkills = []) => {
  const mentors = await MentorProfile.find().populate("user", "name avatar");
  return mentors
    .map((m) => ({
      mentor: m,
      similarityScore: calculateCosineSimilarity(studentSkills, m.expertise || []),
    }))
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, 5)
    .map((item) => item.mentor);
};

module.exports = { getRecommendedMentors, calculateCosineSimilarity };