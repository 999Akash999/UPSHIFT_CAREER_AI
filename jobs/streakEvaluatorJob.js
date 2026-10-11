const Student = require("../models/Student");
const { sendNotification } = require("../services/notificationService");
const { getDayBoundsIST } = require("../utils/timeHelpers");

const streakEvaluatorJob = async () => {
  console.log("⚡ [Job: StreakEvaluator] Evaluating yesterday's activity and streaks...");

  // Use the same IST calendar boundary as activity recording, regardless of
  // the timezone configured on the server hosting this job.
  const today = getDayBoundsIST();
  const startOfYesterday = new Date(today.start.getTime() - 24 * 60 * 60 * 1000);

  const inactiveStudents = await Student.find({
    streak: { $gt: 0 },
    lastActivityDate: { $lt: startOfYesterday },
  }).populate("user", "name");
  if (!inactiveStudents.length) return;

  const ids = inactiveStudents.map((student) => student._id);
  await Student.updateMany(
    { _id: { $in: ids }, streak: { $gt: 0 }, lastActivityDate: { $lt: startOfYesterday } },
    { $set: { streak: 0 } }
  );
  const notifications = inactiveStudents.filter((student) => student.user).map((student) => sendNotification({
    recipientId: student.user._id,
    title: "💔 Streak Reset",
    message: `Your ${student.streak}-day streak ended because no daily tasks were completed yesterday. Start fresh today!`,
    category: "streak",
    actionUrl: "/student/daily-tasks",
  }));
  const results = await Promise.allSettled(notifications);
  const failed = results.filter((result) => result.status === "rejected").length;
  console.log(`✅ [Job: StreakEvaluator] Reset ${inactiveStudents.length} streak(s); ${failed} notification(s) failed.`);
};

module.exports = streakEvaluatorJob;
