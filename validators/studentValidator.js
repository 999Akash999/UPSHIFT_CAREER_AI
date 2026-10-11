const Joi = require("joi");

const educationSchema = Joi.object({
  college: Joi.string().trim().min(2).max(150).required().messages({
    "string.empty": "College/University name is required",
  }),
  degree: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Degree program is required",
  }),
  graduationYear: Joi.number()
    .integer()
    .min(2000)
    .max(2035)
    .required()
    .messages({
      "number.base": "Graduation year must be a valid number",
      "number.min": "Graduation year cannot be earlier than 2000",
      "number.max": "Graduation year must be realistic",
    }),
  cgpa: Joi.number().min(0).max(10).precision(2).default(0).messages({
    "number.min": "CGPA cannot be negative",
    "number.max": "CGPA cannot exceed 10.0",
  }),
});

const skillsSchema = Joi.object({
  skills: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string().trim().min(1).max(50)),
      Joi.string().trim().allow("")
    )
    .required()
    .messages({
      "any.required": "Skills field is required",
    }),
});

const careerGoalSchema = Joi.object({
  targetRole: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Target career role is required",
  }),
  primaryDomain: Joi.string().trim().min(2).max(100).default("Web Development"),
});

const updateProfileSchema = Joi.object({
  targetRole: Joi.string().trim().min(2).max(100),
  skills: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().trim().allow("")
  ),
  bio: Joi.string().trim().max(500).allow(""),
  githubUrl: Joi.string().trim().uri().allow(""),
  linkedinUrl: Joi.string().trim().uri().allow(""),
  leetcodeUrl: Joi.string().trim().uri().allow(""),
  portfolioUrl: Joi.string().trim().uri().allow(""),
});

module.exports = {
  educationSchema,
  skillsSchema,
  careerGoalSchema,
  updateProfileSchema,
};
