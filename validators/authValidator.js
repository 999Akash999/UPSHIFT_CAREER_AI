const Joi = require("joi");

const signupSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Name is required",
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name cannot exceed 100 characters",
  }),
  email: Joi.string().trim().email().lowercase().required().messages({
    "string.empty": "Email is required",
    "string.email": "Please provide a valid email address",
  }),
  password: Joi.string().min(8).max(128).required().messages({
    "string.empty": "Password is required",
    "string.min": "Password must be at least 8 characters long",
  }),
  role: Joi.string()
    .valid("student", "alumni", "recruiter", "mentor")
    .default("student")
    .messages({
      "any.only": "Invalid role selected",
    }),
});

const loginSchema = Joi.object({
  username: Joi.string().trim().email().lowercase().required().messages({
    "string.empty": "Email address is required",
    "string.email": "Please provide a valid email address",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required",
  }),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().email().lowercase().required().messages({
    "string.empty": "Email address is required",
    "string.email": "Please provide a valid email address",
  }),
});

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(8).max(128).required().messages({
    "string.empty": "New password is required",
    "string.min": "Password must be at least 8 characters long",
  }),
  confirmPassword: Joi.string()
    .valid(Joi.ref("password"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "string.empty": "Confirm password is required",
    }),
});

module.exports = {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};