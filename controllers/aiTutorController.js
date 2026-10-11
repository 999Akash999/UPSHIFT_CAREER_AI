const AIConversation = require("../models/AIConversation");
const Student = require("../models/Student");
const AI_CONFIG = require("../config/aiConfig");
const { generateAIContent } = require("../services/aiService");

exports.renderChatUI = async (req, res) => {
  const student = await Student.findOne({ user: req.user._id });
  const conversation = await AIConversation.findOne({
    user: req.user._id,
    type: "tutor",
  }).sort({ updatedAt: -1 });

  res.render("student/ai-tutor", {
    title: "AI Engineering Tutor",
    student,
    messages: conversation ? conversation.messages : [],
  });
};

exports.askDoubt = async (req, res) => {
  try {
    const { prompt, codeSnippet } = req.body;
    if (!String(prompt || "").trim()) return res.status(400).json({ error: "Prompt is required" });
    if (!AI_CONFIG.isConfigured) return res.status(503).json({ error: "AI tutoring is unavailable until GEMINI_API_KEY (or GOOGLE_API_KEY) is configured." });
    if (String(prompt).length > 6000 || String(codeSnippet || "").length > 12000) {
      return res.status(413).json({ error: "The prompt or code sample is too long." });
    }

    let conversation = null;
    let history = [];
    try {
      conversation = await AIConversation.findOne({ user: req.user._id, type: "tutor" });
      history = (conversation?.messages || []).slice(-6).map((message) => ({ role: message.role, content: message.content }));
    } catch (historyError) {
      // A history read should not prevent the tutor from answering the current question.
      console.warn("AI Tutor history unavailable:", historyError.message);
    }

    const userMessageContent = codeSnippet 
      ? `${prompt}\n\n\`\`\`javascript\n${codeSnippet}\n\`\`\`` 
      : prompt;

    const messagesPayload = [
      { role: "system", content: AI_CONFIG.systemPrompts.tutor },
      ...history,
      { role: "user", content: userMessageContent },
    ];

    const aiReply = await generateAIContent({
      messages: messagesPayload,
      temperature: 0.4,
      maxTokens: AI_CONFIG.maxTokens.chat,
    });

    // Persistence is best-effort: a database write must not hide a valid AI answer.
    let saved = true;
    try {
      if (!conversation) conversation = new AIConversation({ user: req.user._id, type: "tutor", messages: [] });
      conversation.messages.push(
        { role: "user", content: userMessageContent, timestamp: new Date() },
        { role: "assistant", content: aiReply, timestamp: new Date() }
      );
      await conversation.save();
    } catch (saveError) {
      saved = false;
      console.error("AI Tutor reply could not be saved:", saveError.message);
    }

    res.json({ success: true, reply: aiReply, saved });
  } catch (err) {
    console.error("AI Tutor Error:", err.message);
    res.status(err.status || 502).json({ error: err.message || "Failed to consult AI tutor." });
  }
};
