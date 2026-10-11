const Student = require("../models/Student");
const DailyTask = require("../models/DailyTask");
const { sendNotification } = require("../services/notificationService");
const { sendSystemEmail } = require("../services/emailService");
const getAppBaseUrl = require("../config/appBaseUrl");

const dailyReminderJob = async () => {
  console.log("⚡ [Job: DailyReminder] Scanning pending tasks for today...");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Group pending daily tasks by student
  const pendingTasks = await DailyTask.aggregate([
    {
      $match: {
        dueDate: { $gte: startOfDay,$lte: endOfDay },
        isCompleted: false,
      },
    },
    {
      $group: {
        _id: "$student",
        taskCount: { $sum: 1 },
        sampleTaskTitles: { $push: "$title" },
      },
    },
  ]);

  if (!pendingTasks.length) {
    console.log("ℹ️ [Job: DailyReminder] No pending tasks found for today.");
    return;
  }

  for (const group of pendingTasks) {
    const student = await Student.findById(group._id).populate("user");
    if (!student || !student.user) continue;

    const taskCount = group.taskCount;
    const taskPreview = group.sampleTaskTitles.slice(0, 3).map((t) => `• ${t}`).join("<br/>");

    // 1. In-App Notification
    await sendNotification({
      recipientId: student.user._id,
      title: "🎯 You have pending tasks today!",
      message: `You have ${taskCount} scheduled milestone task(s) for today. Complete them to maintain your streak.`,
      category: "roadmap",
      actionUrl: "/student/daily-tasks",
    });

    // 2. Email Digest
    await sendSystemEmail({
      to: student.user.email,
      subject: `Morning Roadmap Action: ${taskCount} tasks waiting on UPSHIFT`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Good morning, ${student.user.name}!</h2>
          <p>You have <strong>${taskCount}</strong> key learning tasks scheduled on your roadmap today:</p>
          <div style="background-color: #f4f6f8; padding: 12px; border-radius: 6px; margin: 15px 0;">
            ${taskPreview}
          </div>
          <a href="${getAppBaseUrl()}/student/daily-tasks"
             style="background-color: #4f46e5; color: white; padding: 10px 18px; text-decoration: none; border-radius: 4px; display: inline-block;">
             Open Today's Tasks
          </a>
        </div>
      `,
    });
  }

  console.log(`✅ [Job: DailyReminder] Dispatched alerts to ${pendingTasks.length} student(s).`);
};

module.exports = dailyReminderJob;
