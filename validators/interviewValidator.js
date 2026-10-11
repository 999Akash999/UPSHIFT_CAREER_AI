const Joi = require("joi");

const startInterviewSchema = Joi.object({
  roleType: Joi.string().trim().min(2).max(100).default("Software Engineer"),
  difficulty: Joi.string().valid("Entry", "Mid-Level", "Senior").default("Entry"),
});

const submitAnswerSchema = Joi.object({
  sessionId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid interview session ID format",
    }),
  question: Joi.string().trim().min(5).max(1000).required().messages({
    "string.empty": "Question text is required",
  }),
  answer: Joi.string().trim().min(2).max(5000).required().messages({
    "string.empty": "Candidate answer cannot be empty",
    "string.min": "Answer is too short to evaluate",
  }),
});

module.exports = {
  startInterviewSchema,
  submitAnswerSchema,
};