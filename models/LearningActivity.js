const mongoose = require("mongoose");

const learningActivitySchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    activityType: {
      type: String,
      enum: ["video_lesson", "reading_resource", "practice_quiz", "coding_task"],
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "onModel",
    },
    lessonId: { type: String, trim: true },
    onModel: {
      type: String,
      enum: ["Course", "LearningResource", "Assessment", "DailyTask"],
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LearningActivity", learningActivitySchema);
