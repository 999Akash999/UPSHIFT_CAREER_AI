const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  lesson: { type: String, default: "" },
  keyConcepts: [{ type: String }],
  example: { type: String, default: "" },
  practice: { type: String, default: "" },
});

const quizSchema = new mongoose.Schema({
  question: { type: String, default: "" },
  options: [{ type: String }],
  correctIndex: { type: Number, default: 0 },
  explanation: { type: String, default: "" },
}, { _id: false });

const dailyLearningSchema = new mongoose.Schema({
  title: { type: String, default: "" },
  difficulty: { type: String, enum: ["Beginner", "Intermediate", "Advanced", "Standard"], default: "Standard" },
  difficultySource: { type: String, enum: ["assessment", "roadmap", "standard"], default: "standard" },
  summary: { type: String, default: "" },
  lesson: { type: String, default: "" },
  prerequisites: [{ type: String }],
  keyConcepts: [{ type: String }],
  walkthrough: [{ type: String }],
  example: { type: String, default: "" },
  commonMistakes: [{ type: String }],
  practiceTasks: [{ type: String }],
  recap: [{ type: String }],
  quiz: { type: quizSchema, default: () => ({}) },
}, { _id: false });

const weekSchema = new mongoose.Schema({
  weekNumber: { type: Number, required: true },
  theme: { type: String, required: true },
  milestones: [milestoneSchema],
  dailyTasks: [{ type: String }],
  dailyTaskCompletions: { type: [Boolean], default: [] },
  dailyLearning: { type: [dailyLearningSchema], default: [] },
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
      default: 26,
    },
    hoursPerDay: { type: Number, default: 2, min: 0.5, max: 12 },
    daysPerWeek: { type: Number, default: 5, min: 1, max: 7 },
    experienceLevel: { type: String, default: "beginner", trim: true },
    focusAreas: [{ type: String, trim: true }],
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
