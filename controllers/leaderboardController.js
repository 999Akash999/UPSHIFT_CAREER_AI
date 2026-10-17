const DailyTask = require("../models/DailyTask");
const SkillAssessment = require("../models/SkillAssessment");
const Student = require("../models/Student");
const User = require("../models/User");

const PAGE_SIZE = 50;

exports.getLeaderboard = async (req, res) => {
  try {
    const users = await User.find({ role: "student", isActive: { $ne: false } })
      .select("name avatar createdAt")
      .lean();
    const userIds = users.map((user) => user._id);

    const [profiles, taskTotals, assessmentBests] = await Promise.all([
      Student.find({ user: { $in: userIds } }).select("_id user").lean(),
      DailyTask.aggregate([
        { $match: { isCompleted: true } },
        { $group: { _id: "$student", completedTasks: { $sum: 1 } } },
      ]),
      SkillAssessment.aggregate([
        { $group: {
          _id: { student: "$student", assessment: "$assessment" },
          bestScore: { $max: "$score" },
        } },
      ]),
    ]);

    const profileByUser = new Map(profiles.map((profile) => [String(profile.user), String(profile._id)]));
    const tasksByProfile = new Map(taskTotals.map((item) => [String(item._id), item.completedTasks]));
    const assessmentPointsByUser = new Map();
    for (const attempt of assessmentBests) {
      const userId = String(attempt._id.student);
      // Each assessment contributes at most 10 points, based on the learner's
      // best result, so repeating the same assessment does not inflate rank.
      assessmentPointsByUser.set(
        userId,
        (assessmentPointsByUser.get(userId) || 0) + (Number(attempt.bestScore) / 10)
      );
    }

    const rankedStudents = users.map((user) => {
      const completedTasks = tasksByProfile.get(profileByUser.get(String(user._id))) || 0;
      const assessmentPoints = Number((assessmentPointsByUser.get(String(user._id)) || 0).toFixed(1));
      const learningPoints = completedTasks * 10;
      const totalScore = Number((learningPoints + assessmentPoints).toFixed(1));
      return {
        id: String(user._id),
        name: user.name,
        avatar: user.avatar,
        completedTasks,
        learningPoints,
        assessmentPoints,
        totalScore,
      };
    }).sort((a, b) => b.totalScore - a.totalScore
      || b.assessmentPoints - a.assessmentPoints
      || b.completedTasks - a.completedTasks
      || a.name.localeCompare(b.name));

    rankedStudents.forEach((student, index) => {
      student.rank = index > 0 && student.totalScore === rankedStudents[index - 1].totalScore
        ? rankedStudents[index - 1].rank
        : index + 1;
    });
    const currentRank = rankedStudents.find((student) => student.id === String(req.user._id));
    const requestedPage = Number.parseInt(req.query.page, 10);
    const totalPages = Math.max(1, Math.ceil(rankedStudents.length / PAGE_SIZE));
    const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
    const students = rankedStudents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return res.render("student/leaderboard", {
      title: "Student Leaderboard | UPSHIFT CAREER",
      students,
      currentRank,
      totalStudents: rankedStudents.length,
      page,
      totalPages,
    });
  } catch (error) {
    console.error("Student leaderboard failed:", error.stack || error);
    req.flash("error", "The leaderboard could not load right now. Please try again.");
    return res.redirect("/student/dashboard");
  }
};
