const mongoose = require("mongoose");

const employabilitySnapshotSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    overallScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    breakdown: {
      technical: { type: Number, default: 0, min: 0, max: 100 },
      problemSolving: { type: Number, default: 0, min: 0, max: 100 },
      roadmapProgress: { type: Number, default: 0, min: 0, max: 100 },
      softSkills: { type: Number, default: 0, min: 0, max: 100 },
      projects: { type: Number, default: 0, min: 0, max: 100 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmployabilitySnapshot", employabilitySnapshotSchema);