const mongoose = require("mongoose");

const dsaPracticeAttemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  questionId: { type: String, required: true, trim: true },
  attemptCount: { type: Number, default: 0, min: 0 },
  lastSelectedIndex: { type: Number, min: 0 },
  isSolved: { type: Boolean, default: false, index: true },
  solvedAt: { type: Date, default: null },
  lastAttemptAt: { type: Date, default: Date.now },
}, { timestamps: true });

dsaPracticeAttemptSchema.index({ user: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model("DsaPracticeAttempt", dsaPracticeAttemptSchema);
