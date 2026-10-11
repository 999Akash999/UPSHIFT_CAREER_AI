const mongoose = require("mongoose");

const recruiterInterviewSchema = new mongoose.Schema({
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: "JobApplication", default: null },
  scheduledAt: { type: Date, required: true, index: true },
  durationMinutes: { type: Number, enum: [15, 30, 45, 60, 90], default: 30 },
  format: { type: String, enum: ["video", "phone", "onsite"], default: "video" },
  locationOrLink: { type: String, trim: true, maxlength: 500, default: "" },
  notes: { type: String, trim: true, maxlength: 1500, default: "" },
  status: { type: String, enum: ["scheduled", "accepted", "declined", "cancelled", "completed"], default: "scheduled", index: true },
  respondedAt: { type: Date, default: null },
}, { timestamps: true });

recruiterInterviewSchema.index({ recruiter: 1, scheduledAt: 1 });
recruiterInterviewSchema.index({ student: 1, scheduledAt: 1 });

module.exports = mongoose.model("RecruiterInterview", recruiterInterviewSchema);
