const mongoose = require("mongoose");

const mentorshipBookingSchema = new mongoose.Schema(
  {
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Mentor reference is required"],
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student reference is required"],
      index: true,
    },
    sessionDate: {
      type: Date,
      required: [true, "Session timestamp is required"],
    },
    agenda: {
      type: String,
      required: [true, "Session agenda or query topic is required"],
      trim: true,
      maxlength: [1000, "Agenda cannot exceed 1000 characters"],
    },
    meetingLink: {
      type: String,
      trim: true,
      default: "",
    },
    reminderSentAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    review: {
      rating: { type: Number, min: 1, max: 5 },
      feedback: { type: String, trim: true },
      submittedAt: { type: Date },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MentorshipBooking", mentorshipBookingSchema);
