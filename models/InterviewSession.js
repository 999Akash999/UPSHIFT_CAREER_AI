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

const integrityEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, maxlength: 100 },
  type: { type: String, enum: ["TAB_SWITCH", "PAGE_HIDDEN", "WINDOW_BLUR", "BACKGROUND_NOISE"], required: true },
  warningNumber: { type: Number, min: 1, default: null },
  timestamp: { type: Date, default: Date.now },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  reason: { type: String, maxlength: 240, default: "" },
  action: { type: String, enum: ["warning", "ignored", "terminated"], required: true },
}, { _id: false });

const interviewSessionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roleType: { type: String, required: true, trim: true },
    language: { type: String, enum: ["en-IN", "hi-IN"], default: "en-IN" },
    transcript: [transcriptEntrySchema],
    finalScore: { type: Number, min: 0, max: 100, default: null },
    status: { type: String, enum: ["active", "completed", "terminated_integrity"], default: "active", index: true },
    warningCount: { type: Number, min: 0, default: 0 },
    maxWarnings: { type: Number, min: 1, default: 3 },
    integrityEvents: { type: [integrityEventSchema], default: [] },
    terminationReason: { type: String, maxlength: 240, default: null },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    lastIntegrityFocusAt: { type: Date, default: null },
    lastIntegrityNoiseAt: { type: Date, default: null },
    integrityRequestTimes: { type: [Date], default: [] },
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
