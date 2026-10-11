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

const interviewSessionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roleType: { type: String, required: true, trim: true },
    transcript: [transcriptEntrySchema],
    finalScore: { type: Number, min: 0, max: 100, default: null },
    status: { type: String, enum: ["active", "completed"], default: "active", index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InterviewSession", interviewSessionSchema);
