const DsaPracticeAttempt = require("../models/DsaPracticeAttempt");
const Student = require("../models/Student");
const questionBank = require("../data/dsaQuestionBank");
const { recordDsaPractice } = require("../services/streakService");
const { getDateKeyIST, getDayBoundsIST } = require("../utils/timeHelpers");

const badgeDefinitions = [
  { id: "first-solve", title: "First Solve", description: "Solve your first DSA question.", type: "solves", target: 1 },
  { id: "five-solves", title: "Pattern Starter", description: "Solve 5 different DSA questions.", type: "solves", target: 5 },
  { id: "ten-solves", title: "Problem Solver", description: "Solve 10 different DSA questions.", type: "solves", target: 10 },
  { id: "three-day-streak", title: "3 Day Streak", description: "Practice DSA on 3 consecutive days.", type: "streak", target: 3 },
  { id: "seven-day-streak", title: "Week of Practice", description: "Practice DSA on 7 consecutive days.", type: "streak", target: 7 },
  { id: "thirty-day-streak", title: "Consistency Pro", description: "Practice DSA on 30 consecutive days.", type: "streak", target: 30 },
];

const getBadgeState = (student, solvedCount, streak) => badgeDefinitions.map((badge) => {
  const value = badge.type === "solves" ? solvedCount : streak;
  return {
    ...badge,
    earned: (student.dsaBadges || []).includes(badge.id),
    progress: Math.min(100, Math.round((value / badge.target) * 100)),
    progressLabel: `${Math.min(value, badge.target)} / ${badge.target}`,
  };
});

exports.getPractice = async (req, res) => {
  const today = getDayBoundsIST();
  const [student, attempts, solvedCount, solvedToday] = await Promise.all([
    Student.findById(req.student._id),
    DsaPracticeAttempt.find({ user: req.user._id }).select("questionId attemptCount isSolved lastSelectedIndex"),
    DsaPracticeAttempt.countDocuments({ user: req.user._id, isSolved: true }),
    DsaPracticeAttempt.countDocuments({ user: req.user._id, isSolved: true, solvedAt: { $gte: today.start, $lt: today.end } }),
  ]);
  const attemptById = new Map(attempts.map((attempt) => [attempt.questionId, attempt]));
  const lastPracticeKey = student?.dsaLastPracticeDate ? getDateKeyIST(student.dsaLastPracticeDate) : null;
  const todayKey = getDateKeyIST(today.start);
  const yesterdayKey = getDateKeyIST(new Date(today.start.getTime() - 24 * 60 * 60 * 1000));
  const currentStreak = [todayKey, yesterdayKey].includes(lastPracticeKey) ? student?.dsaStreak || 0 : 0;
  const questions = questionBank.map(({ id, title, pattern, difficulty, prompt, choices, hint }) => ({
    id, title, pattern, difficulty, prompt, choices, hint,
    attempt: attemptById.get(id) || null,
  }));

  res.render("student/dsa-practice", {
    title: "DSA Practice",
    questions,
    solvedCount,
    solvedToday,
    currentStreak,
    bestStreak: student?.dsaBestStreak || 0,
    badges: getBadgeState(student || {}, solvedCount, currentStreak),
  });
};

exports.submitAnswer = async (req, res) => {
  try {
    const { questionId, selectedIndex } = req.body || {};
    const question = questionBank.find((item) => item.id === questionId);
    if (!question) return res.status(404).json({ error: "DSA question not found." });
    const answerIndex = Number(selectedIndex);
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= question.choices.length) {
      return res.status(400).json({ error: "Choose one answer before checking." });
    }

    let attempt = await DsaPracticeAttempt.findOne({ user: req.user._id, questionId: question.id });
    if (attempt?.isSolved) {
      return res.json({ success: true, isCorrect: true, alreadySolved: true, explanation: question.explanation });
    }
    if (!attempt) attempt = new DsaPracticeAttempt({ user: req.user._id, questionId: question.id });
    attempt.attemptCount += 1;
    attempt.lastSelectedIndex = answerIndex;
    attempt.lastAttemptAt = new Date();
    const isCorrect = answerIndex === question.correctIndex;
    if (isCorrect) {
      attempt.isSolved = true;
      attempt.solvedAt = new Date();
    }
    await attempt.save();

    let student = req.student;
    if (isCorrect) student = await recordDsaPractice(req.student._id) || student;
    const today = getDayBoundsIST();
    const [solvedCount, solvedToday] = await Promise.all([
      DsaPracticeAttempt.countDocuments({ user: req.user._id, isSolved: true }),
      DsaPracticeAttempt.countDocuments({ user: req.user._id, isSolved: true, solvedAt: { $gte: today.start, $lt: today.end } }),
    ]);

    const earned = new Set(student.dsaBadges || []);
    for (const badge of badgeDefinitions) {
      const count = badge.type === "solves" ? solvedCount : (student.dsaStreak || 0);
      if (count >= badge.target) earned.add(badge.id);
    }
    if (earned.size !== (student.dsaBadges || []).length) {
      student.dsaBadges = [...earned];
      await student.save();
    }

    res.json({
      success: true,
      isCorrect,
      attemptCount: attempt.attemptCount,
      explanation: isCorrect ? question.explanation : null,
      hint: isCorrect ? null : question.hint,
      correctAnswer: isCorrect ? question.choices[question.correctIndex] : null,
      solvedCount,
      solvedToday,
      currentStreak: student.dsaStreak || 0,
      bestStreak: student.dsaBestStreak || 0,
      badges: getBadgeState(student, solvedCount, student.dsaStreak || 0),
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "This question was just submitted. Refresh to see your progress." });
    console.error("DSA practice submission failed:", error);
    res.status(500).json({ error: "Could not save your practice result. Please try again." });
  }
};

exports.recordCodeSolve = async (req, res) => {
  try {
    const student = await recordDsaPractice(req.student._id);
    if (!student) return res.status(404).json({ error: "Student profile not found." });
    res.json({ success: true, currentStreak: student.dsaStreak || 0, bestStreak: student.dsaBestStreak || 0 });
  } catch (error) {
    console.error("DSA code practice result failed:", error);
    res.status(500).json({ error: "Could not save your practice streak. Please try again." });
  }
};
