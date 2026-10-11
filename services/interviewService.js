const { generateAIContent } = require("./aiService");
const AI_CONFIG = require("../config/aiConfig");

const evaluateResponse = async ({ question, candidateAnswer, roleType = "Software Engineer" }) => {
  const prompt = `Role Interviewing for: ${roleType}
Question Asked: "${question}"
Candidate Answer: "${candidateAnswer}"

Evaluate strictly as JSON:
{
  "technicalAccuracyScore": 75,
  "communicationScore": 80,
  "strengths": ["Clear problem statement", "Mentioned time complexity"],
  "gaps": ["Did not account for network failure edge cases"],
  "starImprovement": "Situation: ..., Task: ..., Action: ..., Result: ...",
  "followUpQuestion": "How would you handle a distributed cache invalidation in that system?"
}`;

  const messages = [
    { role: "system", content: AI_CONFIG.systemPrompts.interviewCoach },
    { role: "user", content: prompt },
  ];

  const fallback = {
    technicalAccuracyScore: 70,
    communicationScore: 75,
    strengths: ["Direct answer to core question"],
    gaps: ["Needs more specific quantifiable results"],
    starImprovement: "Structure your response with clear Context, Problem, Decision, and Measurable Impact.",
    followUpQuestion: "Can you elaborate on how you validated performance under peak traffic?",
  };

  const result = await generateAIContent({ messages, jsonMode: true, temperature: 0.3 });
  return result || fallback;
};

module.exports = { evaluateResponse };