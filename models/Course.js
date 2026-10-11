const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Lesson title is required"],
    trim: true,
  },
  videoUrl: {
    type: String,
    trim: true,
  },
  durationMinutes: {
    type: Number,
    default: 0,
  },
  content: {
    type: String,
    trim: true,
    maxlength: 12000,
  },
  codeExample: {
    type: String,
    trim: true,
    maxlength: 6000,
  },
  practiceTask: {
    type: String,
    trim: true,
    maxlength: 2000,
  },
  isFreePreview: {
    type: Boolean,
    default: false,
  },
  resources: [
    {
      title: String,
      fileUrl: String,
    },
  ],
});

const moduleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Module title is required"],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  lessons: [lessonSchema],
});

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters"],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    thumbnail: {
      type: String,
      default: "/images/courses/default-thumbnail.jpg",
    },
    description: {
      type: String,
      required: [true, "Course description is required"],
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    price: {
      type: Number,
      required: [true, "Course price is required"],
      min: [0, "Price cannot be negative"],
    },
    discountPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: ["Full Stack", "Data Science & AI", "DevOps & Cloud", "System Design", "Core CS"],
      index: true,
    },
    targetSkillGaps: [
      {
        type: String,
        trim: true,
        index: true,
      },
    ],
    modules: [moduleSchema],
    level: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Intermediate",
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    enrolledCount: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", courseSchema);
