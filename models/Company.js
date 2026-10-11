const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Company name is required"],
      unique: true,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
      match: [/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/, "Please provide a valid website URL"],
    },
    logo: {
      type: String,
      default: "/images/companies/default-logo.png",
    },
    industry: {
      type: String,
      required: [true, "Industry domain is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2500, "Description cannot exceed 2500 characters"],
    },
    location: {
      type: String,
      trim: true,
      default: "Bengaluru, India",
    },
    tier: {
      type: String,
      enum: ["Startup", "Mid-Size", "Enterprise", "MNC"],
      default: "Startup",
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", companySchema);