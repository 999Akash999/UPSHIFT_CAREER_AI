const mongoose = require("mongoose");
const passportLocalMongooseModule = require("passport-local-mongoose");
const passportLocalMongoose =
  passportLocalMongooseModule.default || passportLocalMongooseModule;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    role: {
      type: String,
      enum: ["student", "alumni", "recruiter", "mentor", "admin"],
      default: "student",
      index: true,
    },
    avatar: {
      type: String,
      default: "/images/avatars/default.png",
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isOnboarded: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Plugin passport-local-mongoose for hashing, salting & serialization
userSchema.plugin(passportLocalMongoose, {
  usernameField: "email",
  errorMessages: {
    UserExistsError: "An account with that email already exists.",
  },
});

module.exports = mongoose.model("User", userSchema);
