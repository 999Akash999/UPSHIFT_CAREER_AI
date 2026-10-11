const mongoose = require("mongoose");

const transcriptEntrySchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    feedback: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const proctoringEventSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, maxlength: 40 },
  message: { type: String, required: true, trim: true, maxlength: 240 },
  severity: { type: String, enum: ["notice", "warning"], default: "notice" },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const interviewSessionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roleType: { type: String, required: true, trim: true },
    language: { type: String, enum: ["en-IN", "hi-IN"], default: "en-IN" },
    transcript: [transcriptEntrySchema],
    finalScore: { type: Number, min: 0, max: 100, default: null },
    status: { type: String, enum: ["active", "completed"], default: "active", index: true },
    proctoring: {
      cameraActive: { type: Boolean, default: false },
      screenActive: { type: Boolean, default: false },
      displaySurface: { type: String, enum: ["monitor", "window", "browser", "unknown"], default: "unknown" },
      warningCount: { type: Number, default: 0, min: 0 },
      events: { type: [proctoringEventSchema], default: [] },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InterviewSession", interviewSessionSchema);
