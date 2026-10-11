const mongoose = require("mongoose");

const dailyQuizSchema = new mongoose.Schema({
  question: { type: String, default: "" },
  options: [{ type: String }],
  correctIndex: { type: Number, default: 0 },
  explanation: { type: String, default: "" },
}, { _id: false });

const dailyTaskSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    roadmap: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Roadmap",
    },
    roadmapWeek: { type: Number, min: 1 },
    roadmapDayIndex: { type: Number, min: 0, max: 6 },
    summary: { type: String, default: "" },
    lesson: { type: String, default: "" },
    prerequisites: [{ type: String }],
    keyConcepts: [{ type: String }],
    walkthrough: [{ type: String }],
    example: { type: String, default: "" },
    commonMistakes: [{ type: String }],
    practiceTasks: [{ type: String }],
    recap: [{ type: String }],
    quiz: { type: dailyQuizSchema, default: undefined },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DailyTask", dailyTaskSchema);
