const mongoose = require("mongoose");

const userPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "system",
    },
    emailNotifications: {
      dailyReminders: { type: Boolean, default: true },
      jobAlerts: { type: Boolean, default: true },
      mentorshipUpdates: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: true },
    },
    profileVisibility: {
      type: String,
      enum: ["public", "recruiters_only", "private"],
      default: "recruiters_only",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserPreference", userPreferenceSchema);