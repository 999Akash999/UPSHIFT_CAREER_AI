const { generateAIContent } = require("./aiService");
const AI_CONFIG = require("../config/aiConfig");

const generateCoachingPlan = async ({ studentProfile, query }) => {
  const prompt = `Student Details:
- Target Role: ${studentProfile.targetRole}
- Current Skills: ${(studentProfile.skills || []).join(", ")}
- Current Streak: ${studentProfile.streak || 0} days
- Academic Baseline: ${studentProfile.academicDetails?.degree || "CS Student"}

Student Question: "${query}"

Provide strategic, encouraging career advice with clear 30-day and 60-day action steps. Format in clean Markdown.`;

  const messages = [
    { role: "system", content: AI_CONFIG.systemPrompts.interviewCoach },
    { role: "user", content: prompt },
  ];

  const response = await generateAIContent({ messages, temperature: 0.5, maxTokens: 1200 });
  return (
    response ||
    "Focus on building high-impact full-stack capstone projects and contributing to open-source repositories to accelerate your profile."
  );
};

module.exports = { generateCoachingPlan };