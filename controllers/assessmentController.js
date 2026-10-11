const Assessment = require("../models/Assessment");
const SkillAssessment = require("../models/SkillAssessment");
const Student = require("../models/Student");
const { recalculateAfterActivity } = require("../services/employabilityService");

exports.getAssessment = async (req, res) => {
  const assessment = await Assessment.findOne({ _id: req.params.id, isPublished: true });
  if (!assessment) return res.status(404).render("errors/404", { title: "Assessment not found" });
  res.render("student/assessment-detail", { title: assessment.title, assessment });
};

exports.submitAssessment = async (req, res) => {
  try {
    const { assessmentId, answers } = req.body;
    const assessment = await Assessment.findOne({ _id: assessmentId, isPublished: true });
    if (!assessment) return res.status(404).json({ error: "Assessment not found." });
    if (!assessment.questions.length) return res.status(400).json({ error: "This assessment has no questions." });
    if (!Array.isArray(answers) || answers.length !== assessment.questions.length || answers.some((answer) => !Number.isInteger(Number(answer)))) {
      return res.status(400).json({ error: "Submit one answer for every question." });
    }

    let score = 0;
    assessment.questions.forEach((q, index) => {
      if (Number(answers?.[index]) === q.correctAnswerIndex) {
        score += q.points || 1;
      }
    });

    const totalPossible = assessment.questions.reduce((acc, q) => acc + (q.points || 1), 0);
    const finalPercentage = Math.round((score / totalPossible) * 100);

    const detailedAnswers = assessment.questions.map((question, questionIndex) => ({
      questionIndex,
      selectedOption: Number(answers?.[questionIndex]),
      isCorrect: Number(answers?.[questionIndex]) === question.correctAnswerIndex,
    }));

    await SkillAssessment.create({
      student: req.user._id,
      assessment: assessmentId,
      score: finalPercentage,
      passed: finalPercentage >= (assessment.passingScore || 60),
      detailedAnswers,
    });

    const student = await Student.findOne({ user: req.user._id }).select("_id");
    if (student) await recalculateAfterActivity(student._id);

    res.json({ success: true, score: finalPercentage, passed: finalPercentage >= (assessment.passingScore || 60) });
  } catch (err) {
    res.status(500).json({ error: "Assessment submission failed." });
  }
};
