const mongoose = require("mongoose");

const referralRequestSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    alumni: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetRole: { type: String, trim: true },
    message: { type: String, trim: true, maxlength: 1500 },
    employabilityScore: { type: Number, min: 0, max: 100, default: 0 },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending", index: true },
  },
  { timestamps: true }
);

referralRequestSchema.index({ student: 1, alumni: 1 }, { unique: true });
module.exports = mongoose.model("ReferralRequest", referralRequestSchema);
