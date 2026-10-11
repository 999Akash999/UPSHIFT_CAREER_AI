const calculateATSScore = (studentSkills = [], requiredSkills = [], studentScore = 0, cutoff = 50) => {
  if (!requiredSkills.length) return 70;

  const normalizedStudent = studentSkills.map((s) => s.toLowerCase().trim());
  const matched = requiredSkills.filter((req) => normalizedStudent.includes(req.toLowerCase().trim()));
  const skillMatchRatio = matched.length / requiredSkills.length;

  const scoreFactor = studentScore >= cutoff ? 1.0 : studentScore / (cutoff || 1);
  const compositeATS = Math.round((skillMatchRatio * 0.7 + scoreFactor * 0.3) * 100);

  return Math.min(100, compositeATS);
};

module.exports = { calculateATSScore };