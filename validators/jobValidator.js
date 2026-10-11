const Joi = require("joi");

const createJobSchema = Joi.object({
  title: Joi.string().trim().min(3).max(120).required().messages({
    "string.empty": "Job title is required",
  }),
  description: Joi.string().trim().min(30).max(10000).required().messages({
    "string.empty": "Job description is required",
    "string.min": "Job description must be at least 30 characters",
  }),
  skillsRequired: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string().trim().min(1)),
      Joi.string().trim().min(1)
    )
    .required()
    .messages({
      "any.required": "Required skills list is required",
    }),
  minEmployabilityScore: Joi.number().integer().min(0).max(100).default(50).messages({
    "number.min": "Score cutoff cannot be lower than 0",
    "number.max": "Score cutoff cannot exceed 100",
  }),
  salaryRange: Joi.string().trim().max(100).allow(""),
  location: Joi.string().trim().max(100).default("Remote"),
  jobType: Joi.string()
    .valid("Full-Time", "Part-Time", "Internship", "Contract")
    .default("Full-Time"),
});

const applyJobSchema = Joi.object({
  jobId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid Job ID format",
    }),
  coverNote: Joi.string().trim().max(2000).allow("").messages({
    "string.max": "Cover note cannot exceed 2000 characters",
  }),
});

module.exports = {
  createJobSchema,
  applyJobSchema,
};