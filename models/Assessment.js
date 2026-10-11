const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  prompt: {
    type: String,
    required: [true, "Question prompt is required"],
    trim: true,
  },
  options: [
    {
      type: String,
      required: true,
      trim: true,
    },
  ],
  correctAnswerIndex: {
    type: Number,
    required: [true, "Correct answer index is required"],
    min: 0,
  },
  explanation: {
    type: String,
    trim: true,
  },
  skill: { type: String, trim: true, default: "" },
  points: {
    type: Number,
    default: 10,
    min: 1,
  },
});

const assessmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Assessment title is required"],
      trim: true,
    },
    domain: {
      type: String,
      required: [true, "Technical domain is required"],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    durationMinutes: {
      type: Number,
      required: [true, "Duration in minutes is required"],
      default: 30,
    },
    passingScore: {
      type: Number,
      default: 60,
      min: 0,
      max: 100,
    },
    questions: [questionSchema],
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Assessment", assessmentSchema);
