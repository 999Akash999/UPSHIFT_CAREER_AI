const mongoose = require("mongoose");

const oauthAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["google", "github", "linkedin", "apple"],
      required: true,
    },
    providerId: {
      type: String,
      required: true,
    },
    profileData: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// Ensure composite uniqueness
oauthAccountSchema.index({ provider: 1, providerId: 1 }, { unique: true });

module.exports = mongoose.model("OAuthAccount", oauthAccountSchema);