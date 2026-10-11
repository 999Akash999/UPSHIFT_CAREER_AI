const InterviewSession = require("../models/InterviewSession");
const AI_CONFIG = require("../config/aiConfig");
const { generateAIContent } = require("../services/aiService");

const TOTAL_QUESTIONS = 10;
const STARTER_QUESTIONS = {
  "en-IN": "Tell me about a technical project you built. What problem did it solve, and what was your contribution?",
  "hi-IN": "Apne banaye hue kisi technical project ke baare mein bataiye. Usne kaunsi problem solve ki, aur usmein aapka contribution kya tha?",
};

const PROCTORING_EVENTS = {
  tab_hidden: { message: "You switched away from the interview tab. Return to the interview and keep the shared screen visible.", severity: "warning" },
  window_blur: { message: "The interview window lost focus. Please stay in the interview room while answering.", severity: "warning" },
  camera_interrupted: { message: "Camera access stopped. Answers are paused until the camera is restored.", severity: "warning" },
  screen_interrupted: { message: "Full-screen sharing stopped. Answers are paused until you share your entire screen again.", severity: "warning" },
  answer_pasted: { message: "Text was pasted into the answer field. Please make sure your response is your own.", severity: "warning" },
  screen_not_monitor: { message: "A full monitor share is required. Window or browser-tab sharing is not accepted.", severity: "warning" },
  device_check_passed: { message: "Camera and entire-screen share are active.", severity: "notice" },
};

const deviceCheckIsValid = (deviceCheck) => deviceCheck?.camera === true
  && deviceCheck?.screen === true
  && deviceCheck?.displaySurface === "monitor";

const ensureProctoringState = (session) => {
  if (!session.proctoring) session.proctoring = {};
  if (!Array.isArray(session.proctoring.events)) session.proctoring.events = [];
  if (!Number.isFinite(session.proctoring.warningCount)) session.proctoring.warningCount = 0;
  if (typeof session.proctoring.cameraActive !== "boolean") session.proctoring.cameraActive = false;
  if (typeof session.proctoring.screenActive !== "boolean") session.proctoring.screenActive = false;
  if (!session.proctoring.displaySurface) session.proctoring.displaySurface = "unknown";
};

exports.renderInterview = (req, res) => {
  res.render("student/interview", { title: "AI Mock Interview", targetRole: req.student?.targetRole || "Software Engineer" });
};

exports.startMockInterview = async (req, res) => {
  try {
    const { roleType } = req.body || {};
    if (!deviceCheckIsValid(req.body?.deviceCheck)) {
      return res.status(400).json({ error: "Allow camera access and share your entire screen before starting the interview." });
    }
    const language = req.body?.language === "hi-IN" ? "hi-IN" : "en-IN";
    const session = await InterviewSession.create({
      student: req.user._id,
      roleType: String(roleType || "Software Engineer").trim().slice(0, 100) || "Software Engineer",
      language,
      transcript: [],
      status: "active",
      proctoring: {
        cameraActive: true,
        screenActive: true,
        displaySurface: "monitor",
        warningCount: 0,
        events: [{ code: "device_check_passed", ...PROCTORING_EVENTS.device_check_passed }],
      },
    });
    res.json({ success: true, sessionId: session._id, question: STARTER_QUESTIONS[language], language, questionNumber: 1, totalQuestions: TOTAL_QUESTIONS });
  } catch (err) {
    res.status(500).json({ error: "Could not initiate session" });
  }
};

exports.verifyDevices = async (req, res) => {
  const session = await InterviewSession.findOne({ _id: req.body?.sessionId, student: req.user._id, status: "active" });
  if (!session) return res.status(404).json({ success: false, error: "Active interview session not found." });
  ensureProctoringState(session);
  if (!deviceCheckIsValid(req.body?.deviceCheck)) {
    session.proctoring.cameraActive = req.body?.deviceCheck?.camera === true;
    session.proctoring.screenActive = req.body?.deviceCheck?.screen === true;
    session.proctoring.displaySurface = ["monitor", "window", "browser"].includes(req.body?.deviceCheck?.displaySurface)
      ? req.body.deviceCheck.displaySurface : "unknown";
    await session.save();
    return res.status(400).json({ success: false, error: "Camera and entire-screen sharing must both be active to continue." });
  }
  session.proctoring.cameraActive = true;
  session.proctoring.screenActive = true;
  session.proctoring.displaySurface = "monitor";
  session.proctoring.events.push({ code: "device_check_passed", ...PROCTORING_EVENTS.device_check_passed });
  session.proctoring.events = session.proctoring.events.slice(-50);
  await session.save();
  return res.json({ success: true, ready: true });
};

exports.recordProctoringEvent = async (req, res) => {
  const { code, sessionId } = req.body || {};
  const event = PROCTORING_EVENTS[code];
  if (!event || !sessionId) return res.status(400).json({ success: false, error: "Invalid interview monitoring event." });
  const session = await InterviewSession.findOne({ _id: sessionId, student: req.user._id, status: "active" });
  if (!session) return res.status(404).json({ success: false, error: "Active interview session not found." });
  ensureProctoringState(session);

  if (code === "camera_interrupted") session.proctoring.cameraActive = false;
  if (code === "screen_interrupted" || code === "screen_not_monitor") session.proctoring.screenActive = false;
  if (event.severity === "warning") session.proctoring.warningCount += 1;
  session.proctoring.events.push({ code, ...event });
  session.proctoring.events = session.proctoring.events.slice(-50);
  await session.save();
  return res.json({ success: true, warningCount: session.proctoring.warningCount, event: { code, ...event } });
};

exports.submitAnswer = async (req, res) => {
  try {
    const { sessionId, answer } = req.body;
    if (!sessionId || !String(answer || "").trim() || String(answer).length > 5000) {
      return res.status(400).json({ error: "An active session and answer are required." });
    }
    const session = await InterviewSession.findOne({ _id: sessionId, student: req.user._id, status: "active" });
    if (!session) return res.status(404).json({ error: "Interview session not found or already completed." });
    if (session.proctoring?.cameraActive !== true || session.proctoring?.screenActive !== true || session.proctoring?.displaySurface !== "monitor") {
      return res.status(409).json({ error: "Your camera and entire-screen share must be active before submitting an answer." });
    }
    if (session.transcript.length >= TOTAL_QUESTIONS) {
      session.status = "completed";
      session.finalScore = Math.round(session.transcript.reduce((sum, item) => sum + (JSON.parse(item.feedback || "{}").score || 0), 0) / TOTAL_QUESTIONS);
      await session.save();
      return res.json({ success: true, completed: true, finalScore: session.finalScore, totalQuestions: TOTAL_QUESTIONS });
    }
    const starterQuestion = STARTER_QUESTIONS[session.language || "en-IN"];
    const question = session.transcript.length === 0
      ? starterQuestion
      : (JSON.parse(session.transcript[session.transcript.length - 1].feedback || "{}").nextQuestion || starterQuestion);
    if (!AI_CONFIG.isConfigured) return res.status(503).json({ error: "AI interview feedback is unavailable until GEMINI_API_KEY (or GOOGLE_API_KEY) is configured." });

    const result = await generateAIContent({
      jsonMode: true,
      maxTokens: AI_CONFIG.maxTokens.eval,
      messages: [
        { role: "system", content: `${AI_CONFIG.systemPrompts.interviewCoach}\nReturn strict JSON only: {"score": number from 0 to 100, "strengths": ["..."], "improvements": ["..."], "sampleAnswer": "...", "nextQuestion": "..."}. Score only the answer to the question. Keep feedback specific and concise. The next question must build on this candidate's answer and target role. Respond in ${session.language === "hi-IN" ? "Hindi or natural Hinglish (keep technical terms in English)" : "Indian English"}.` },
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

    res.json({ success: true, feedback, nextQuestion: feedback.nextQuestion, saved, completed, warningCount: session.proctoring.warningCount, questionNumber: session.transcript.length, totalQuestions: TOTAL_QUESTIONS, finalScore: completed ? session.finalScore : null });
  } catch (err) {
    console.error("Interview evaluation error:", err);
    res.status(err.status || 502).json({ error: err.message || "Evaluation error" });
  }
};
