// models/EmailVerification.js
const mongoose = require("mongoose");

const emailVerificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: "1d" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmailVerification", emailVerificationSchema);