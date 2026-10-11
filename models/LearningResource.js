const mongoose = require("mongoose");

const learningResourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    url: {
      type: String,
      required: [true, "URL is required"],
      trim: true,
    },
    domain: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    resourceType: {
      type: String,
      enum: ["article", "video", "official_doc", "cheatsheet"],
      default: "article",
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    difficulty: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Intermediate",
    },
  },
  { timestamps: true }
);

learningResourceSchema.index({ tags: 1, domain: 1 });

module.exports = mongoose.model("LearningResource", learningResourceSchema);