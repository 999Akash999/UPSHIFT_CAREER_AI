const AI_CONFIG = require("../config/aiConfig");
const Student = require("../models/Student");
const { generateAIContent } = require("../services/aiService");

exports.renderCoach = async (req, res) => {
  const student = req.student || await Student.findOne({ user: req.user._id });
  res.render("student/ai-coach", { title: "AI Career Coach", student });
};

exports.getAdvice = async (req, res) => {
  try {
    const student = req.student || await Student.findOne({ user: req.user._id });
    const careerQuestion = String(req.body.careerQuestion || req.body.query || "").trim();
    if (!careerQuestion) return res.status(400).json({ error: "Please enter a career question." });
    if (!AI_CONFIG.isConfigured) return res.status(503).json({ error: "AI coaching is unavailable until GEMINI_API_KEY (or GOOGLE_API_KEY) is configured." });
    if (!student) return res.status(404).json({ error: "Student profile not found." });

    const advice = await generateAIContent({
      temperature: 0.5,
      maxTokens: 1200,
      messages: [
        {
          role: "system",
          content: AI_CONFIG.systemPrompts.interviewCoach + " You are also an executive tech career coach. Give practical, personalized advice in clear Markdown. Support English, Hindi, and Hinglish; answer in the language the student used and keep technical terms in English.",
        },
        {
          role: "user",
          content: `Student Goal: ${student.targetRole}. Skills: ${(student.skills || []).join(", ")}. Question: ${careerQuestion}`,
        },
      ],
    });

    res.json({ success: true, advice });
  } catch (err) {
    console.error("AI Coach Error:", err.message);
    res.status(err.status || 502).json({ error: err.message || "Failed to generate coaching response." });
  }
};
