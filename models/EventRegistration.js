// models/EventRegistration.js
const mongoose = require("mongoose");

const eventRegistrationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AlumniEvent",
      required: true,
      index: true,
    },
    attended: {
      type: Boolean,
      default: false,
    },
    reminderSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

eventRegistrationSchema.index({ user: 1, event: 1 }, { unique: true });

module.exports = mongoose.model("EventRegistration", eventRegistrationSchema);
