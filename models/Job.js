const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    requiredSkills: [
      {
        type: String,
        trim: true,
      },
    ],
    minScoreCutoff: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    salary: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      default: "Remote",
    },
    type: {
      type: String,
      enum: ["Full-Time", "Part-Time", "Internship", "Contract"],
      default: "Full-Time",
    },
    status: {
      type: String,
      enum: ["active", "closed", "draft"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Job", jobSchema);