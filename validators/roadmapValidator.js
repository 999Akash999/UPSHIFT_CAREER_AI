const Joi = require("joi");

const generateRoadmapSchema = Joi.object({
  targetRole: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Target role is required to build a curriculum",
  }),
  durationWeeks: Joi.number().integer().min(4).max(24).default(8).messages({
    "number.min": "Curriculum must be at least 4 weeks",
    "number.max": "Curriculum cannot exceed 24 weeks",
  }),
});

const toggleMilestoneSchema = Joi.object({
  roadmapId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid roadmap identifier format",
    }),
  weekNumber: Joi.number().integer().min(1).max(52).required(),
  milestoneIndex: Joi.number().integer().min(0).max(50).required(),
});

module.exports = {
  generateRoadmapSchema,
  toggleMilestoneSchema,
};