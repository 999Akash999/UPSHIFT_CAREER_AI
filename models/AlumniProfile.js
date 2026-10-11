const mongoose = require("mongoose");

const alumniProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    currentCompany: {
      type: String,
      trim: true,
    },
    designation: {
      type: String,
      trim: true,
    },
    graduationBatch: {
      type: Number,
      required: true,
    },
    college: {
      type: String,
      trim: true,
    },
    willingToRefer: {
      type: Boolean,
      default: true,
    },
    linkedinUrl: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AlumniProfile", alumniProfileSchema);