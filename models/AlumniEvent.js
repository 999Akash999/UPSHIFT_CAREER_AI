// models/AlumniEvent.js
const mongoose = require("mongoose");

const alumniEventSchema = new mongoose.Schema(
  {
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
    category: {
      type: String,
      enum: ["hackathon", "ideathon", "webinar"],
      default: "webinar",
      index: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    meetLink: {
      type: String,
      trim: true,
    },
    capacity: {
      type: Number,
      default: 100,
      min: 1,
    },
    registrationCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AlumniEvent", alumniEventSchema);
