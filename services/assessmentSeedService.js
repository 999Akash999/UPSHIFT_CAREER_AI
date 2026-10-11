const Assessment = require("../models/Assessment");
const assessmentBank = require("../data/skillAssessmentBank");

const ensureSkillAssessments = async () => {
  // Keep the old two-question demo quiz out of the student catalogue.
  await Assessment.updateOne(
    { title: "Demo JavaScript Fundamentals", domain: "Full Stack" },
    { $set: { isPublished: false } },
  );

  for (const item of assessmentBank) {
    if (item.questions.length !== 60) {
      throw new Error(`${item.title} must contain exactly 60 questions.`);
    }

    const existing = await Assessment.findOne({ title: item.title, domain: item.domain }).select("_id questions");
    if (existing?.questions?.length === 60) continue;

    await Assessment.findOneAndUpdate(
      { title: item.title, domain: item.domain },
      {
        $set: {
          title: item.title,
          domain: item.domain,
          description: item.description,
          durationMinutes: item.durationMinutes,
          passingScore: item.passingScore,
          isPublished: item.isPublished,
          questions: item.questions,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  return assessmentBank.length;
};

module.exports = { ensureSkillAssessments };
