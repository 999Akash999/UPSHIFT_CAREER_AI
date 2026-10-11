// models/Resume.js
const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileName: String,
    parsedSkills: [{ type: String }],
    atsScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resume", resumeSchema);