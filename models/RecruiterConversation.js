const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  body: { type: String, required: true, trim: true, maxlength: 2000 },
  readAt: { type: Date, default: null },
}, { timestamps: true });

const recruiterConversationSchema = new mongoose.Schema({
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", default: null },
  messages: { type: [messageSchema], default: [] },
  lastMessageAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

recruiterConversationSchema.index({ recruiter: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("RecruiterConversation", recruiterConversationSchema);
