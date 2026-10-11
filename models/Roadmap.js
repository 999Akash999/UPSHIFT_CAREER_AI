const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  lesson: { type: String, default: "" },
  keyConcepts: [{ type: String }],
  example: { type: String, default: "" },
  practice: { type: String, default: "" },
});

const weekSchema = new mongoose.Schema({
  weekNumber: { type: Number, required: true },
  theme: { type: String, required: true },
  milestones: [milestoneSchema],
  dailyTasks: [{ type: String }],
});

const roadmapSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    targetRole: {
      type: String,
      required: true,
    },
    durationWeeks: {
      type: Number,
      default: 8,
    },
    weeks: [weekSchema],
    identifiedGaps: [{ type: String }],
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ["in-progress", "completed", "archived"],
      default: "in-progress",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Roadmap", roadmapSchema);
