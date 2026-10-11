const { generateAIContent } = require("./aiService");
const AI_CONFIG = require("../config/aiConfig");

const buildCurriculum = async ({ targetRole, currentSkills, durationWeeks = 8 }) => {
  const prompt = `Design a rigorous, production-focused ${durationWeeks}-week curriculum for someone aiming to become a "${targetRole}".
Their existing skills are: [${currentSkills.join(", ")}].

Return strictly a JSON object with:
{
  "identifiedGaps": ["gap1", "gap2"],
  "weeks": [
    {
      "weekNumber": 1,
      "theme": "Theme title",
      "milestones": [
        { "title": "Milestone title", "isCompleted": false, "lesson": "A clear, self-contained lesson that teaches the topic", "keyConcepts": ["concept and explanation"], "example": "A concrete short example", "practice": "A hands-on exercise with a verifiable outcome" }
      ],
      "dailyTasks": ["Day 1 task", "Day 2 task", "Day 3 task", "Day 4 task", "Day 5 task"]
    }
  ]
}`;

  const messages = [
    { role: "system", content: AI_CONFIG.systemPrompts.roadmapArchitect },
    { role: "user", content: prompt },
  ];

  const fallback = {
    identifiedGaps: ["Advanced System Design", "Microservices", "Docker"],
    weeks: Array.from({ length: durationWeeks }, (_, i) => ({
      weekNumber: i + 1,
      theme: `Module ${i + 1}: Core Industry Competencies`,
      milestones: [
        { title: `Complete Module ${i + 1} practical exercises`, isCompleted: false, lesson: "Study the core ideas for this module, then apply them in a small working example.", keyConcepts: ["Understand the fundamentals", "Compare common approaches"], example: "Build a minimal proof of concept and explain how it works.", practice: "Write, run, and document one practical example." },
        { title: `Deploy Module ${i + 1} milestone project`, isCompleted: false, lesson: "Turn the concept into a production-minded feature and make it available to others.", keyConcepts: ["Reliable implementation", "Testing and deployment"], example: "Deploy a small feature with a README and a working demo.", practice: "Share the demo and verify it works from a clean browser session." },
      ],
      dailyTasks: [
        "Study official architectural documentation",
        "Implement proof of concept in code",
        "Write integration tests",
        "Refactor for performance bottlenecks",
        "Document API contracts in Swagger/Postman",
      ],
    })),
  };

  const result = await generateAIContent({ messages, jsonMode: true, temperature: 0.2, maxTokens: AI_CONFIG.maxTokens.roadmap });
  return result || fallback;
};

module.exports = { buildCurriculum };
