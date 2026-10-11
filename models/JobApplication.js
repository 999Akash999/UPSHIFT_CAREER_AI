const mongoose = require("mongoose");

const jobApplicationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student reference is required"],
      index: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: [true, "Job reference is required"],
      index: true,
    },
    resumeUrl: {
      type: String,
      trim: true,
      default: "",
    },
    coverNote: {
      type: String,
      trim: true,
      maxlength: [2000, "Cover note cannot exceed 2000 characters"],
    },
    employabilityScoreAtApplication: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ["applied", "shortlisted", "interviewing", "offered", "offer-accepted", "offer-declined", "rejected", "withdrawn"],
      default: "applied",
      index: true,
    },
    interviewScheduledDate: {
      type: Date,
    },
    recruiterNotes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Prevent accidental double submissions to the same posting
jobApplicationSchema.index({ student: 1, job: 1 }, { unique: true });

module.exports = mongoose.model("JobApplication", jobApplicationSchema);
