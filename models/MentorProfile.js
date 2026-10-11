const mongoose = require("mongoose");

const mentorProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    expertise: [
      {
        type: String,
        trim: true,
      },
    ],
    bio: {
      type: String,
      maxlength: [1000, "Bio cannot exceed 1000 characters"],
    },
    hourlyRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    defaultMeetingLink: {
      type: String,
      trim: true,
    },
    availability: [
      {
        dayOfWeek: { type: Number, min: 0, max: 6 }, // 0 = Sunday, 6 = Saturday
        startTime: { type: String }, // e.g. "14:00"
        endTime: { type: String },   // e.g. "18:00"
      },
    ],
    rating: {
      type: Number,
      default: 5.0,
      min: 1.0,
      max: 5.0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    verifiedCredentials: {
      type: Boolean,
      default: false,
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MentorProfile", mentorProfileSchema);
