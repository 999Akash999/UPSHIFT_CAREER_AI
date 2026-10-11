const mongoose = require("mongoose");

const replySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: [true, "Reply message cannot be empty"],
      trim: true,
    },
    codeSnippet: {
      type: String,
      trim: true,
    },
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isAcceptedAnswer: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const doubtSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Question title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Detailed explanation is required"],
      trim: true,
    },
    codeSnippet: {
      type: String,
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    isResolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    replies: [replySchema],
  },
  { timestamps: true }
);

doubtSchema.index({ tags: 1 });

module.exports = mongoose.model("Doubt", doubtSchema);