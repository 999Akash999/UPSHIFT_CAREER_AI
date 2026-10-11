const InterviewSession = require("../models/InterviewSession");
const AI_CONFIG = require("../config/aiConfig");
const { generateAIContent } = require("../services/aiService");

const TOTAL_QUESTIONS = 10;
const STARTER_QUESTION = "Tell me about a technical project you built. What problem did it solve, and what was your contribution?";

exports.renderInterview = (req, res) => {
  res.render("student/interview", { title: "AI Mock Interview" });
};

exports.startMockInterview = async (req, res) => {
  try {
    const { roleType } = req.body;
    const session = await InterviewSession.create({
      student: req.user._id,
      roleType: roleType || "Software Engineer",
      transcript: [],
      status: "active",
    });
    res.json({ success: true, sessionId: session._id, question: STARTER_QUESTION, questionNumber: 1, totalQuestions: TOTAL_QUESTIONS });
  } catch (err) {
    res.status(500).json({ error: "Could not initiate session" });
  }
};

exports.submitAnswer = async (req, res) => {
  try {
    const { sessionId, answer } = req.body;
    if (!sessionId || !String(answer || "").trim()) {
      return res.status(400).json({ error: "An active session and answer are required." });
    }
    const session = await InterviewSession.findOne({ _id: sessionId, student: req.user._id, status: "active" });
    if (!session) return res.status(404).json({ error: "Interview session not found or already completed." });
    if (session.transcript.length >= TOTAL_QUESTIONS) {
      session.status = "completed";
      session.finalScore = Math.round(session.transcript.reduce((sum, item) => sum + (JSON.parse(item.feedback || "{}").score || 0), 0) / TOTAL_QUESTIONS);
      await session.save();
      return res.json({ success: true, completed: true, finalScore: session.finalScore, totalQuestions: TOTAL_QUESTIONS });
    }
    const question = session.transcript.length === 0
      ? STARTER_QUESTION
      : (JSON.parse(session.transcript[session.transcript.length - 1].feedback || "{}").nextQuestion || STARTER_QUESTION);
    if (!AI_CONFIG.isConfigured) return res.status(503).json({ error: "AI interview feedback is unavailable until GEMINI_API_KEY (or GOOGLE_API_KEY) is configured." });

    const result = await generateAIContent({
      jsonMode: true,
      maxTokens: AI_CONFIG.maxTokens.eval,
      messages: [
        { role: "system", content: `${AI_CONFIG.systemPrompts.interviewCoach}\nReturn strict JSON only: {"score": number from 0 to 100, "strengths": ["..."], "improvements": ["..."], "sampleAnswer": "...", "nextQuestion": "..."}. Score only the answer to the question. Keep feedback specific and concise. The next question must build on this candidate's answer and target role.` },
        { role: "user", content: `Role: ${session.roleType}\nQuestion: ${question}\nCandidate answer: ${answer}` },
      ],
    });

    if (!result || typeof result !== "object") throw new Error("The interviewer returned an empty evaluation. Please try again.");
    const feedback = {
      score: Math.max(0, Math.min(100, Number(result.score) || 0)),
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      improvements: Array.isArray(result.improvements) ? result.improvements : [],
      sampleAnswer: String(result.sampleAnswer || ""),
      nextQuestion: String(result.nextQuestion || "Tell me more about your approach and the trade-offs you considered."),
    };

    session.transcript.push({ question, answer: String(answer).trim(), feedback: JSON.stringify(feedback) });
    const completed = session.transcript.length >= TOTAL_QUESTIONS;
    if (completed) {
      session.finalScore = Math.round(session.transcript.reduce((sum, item) => sum + (JSON.parse(item.feedback || "{}").score || 0), 0) / TOTAL_QUESTIONS);
      session.status = "completed";
    }
    let saved = true;
    try {
      await session.save();
    } catch (saveError) {
      saved = false;
      console.error("Interview feedback could not be saved:", saveError.message);
    }

    res.json({ success: true, feedback, nextQuestion: feedback.nextQuestion, saved, completed, questionNumber: session.transcript.length, totalQuestions: TOTAL_QUESTIONS, finalScore: completed ? session.finalScore : null });
  } catch (err) {
    console.error("Interview evaluation error:", err);
    res.status(err.status || 502).json({ error: err.message || "Evaluation error" });
  }
};
