const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    academicDetails: {
      college: { type: String, trim: true },
      degree: { type: String, trim: true },
      graduationYear: { type: Number },
      cgpa: { type: Number, min: 0, max: 10, default: 0 },
    },
    targetRole: {
      type: String,
      default: "Full Stack Developer",
      trim: true,
    },
    primaryDomain: {
      type: String,
      default: "Web Development",
    },
    careerDetails: {
      preferredLocation: { type: String, trim: true, maxlength: 100 },
      workMode: { type: String, enum: ["", "Remote", "Hybrid", "On-site"], default: "" },
      experienceYears: { type: Number, min: 0, max: 50, default: 0 },
      availability: { type: String, enum: ["", "Immediately", "Within 1 month", "Within 3 months", "Not looking"], default: "" },
      certifications: [{ type: String, trim: true, maxlength: 120 }],
    },
    skills: [
      {
        type: String,
        trim: true,
      },
    ],
    identifiedGaps: [
      {
        type: String,
        trim: true,
      },
    ],
    streak: {
      type: Number,
      default: 0,
    },
    dsaStreak: {
      type: Number,
      default: 0,
    },
    dsaBestStreak: {
      type: Number,
      default: 0,
    },
    dsaLastPracticeDate: {
      type: Date,
      default: null,
    },
    dsaBadges: [{ type: String, trim: true }],
    lastActivityDate: {
      type: Date,
      default: null,
    },
    socialProfiles: {
      github: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      leetcode: { type: String, trim: true },
      portfolio: { type: String, trim: true },
    },
    enrolledCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);
