const Student = require("../models/Student");
const DailyTask = require("../models/DailyTask");
const EmployabilitySnapshot = require("../models/EmployabilitySnapshot");
const { sendSystemEmail } = require("../services/emailService");
const { sendNotification } = require("../services/notificationService");

const weeklyProgressJob = async () => {
  console.log("⚡ [Job: WeeklyProgress] Compiling weekly learning summaries...");

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const students = await Student.find().populate("user");

  for (const student of students) {
    if (!student.user || !student.user.isActive) continue;

    // 1. Calculate tasks completed over the last 7 days
    const completedCount = await DailyTask.countDocuments({
      student: student._id,
      isCompleted: true,
      completedAt: { $gte: sevenDaysAgo },
    });
    const plannedCount = await DailyTask.countDocuments({
      student: student._id,
      dueDate: { $gte: sevenDaysAgo, $lte: new Date() },
    });
    const needsSupport = plannedCount >= 3 && completedCount / plannedCount < 0.5;

    // 2. Fetch current employability score
    const latestScoreRecord = await EmployabilitySnapshot.findOne({
      student: student._id,
    }).sort({ createdAt: -1 });

    const currentScore = latestScoreRecord ? latestScoreRecord.overallScore : 0;

    // 3. Dispatch in-app notification
    await sendNotification({
      recipientId: student.user._id,
      title: needsSupport ? "🌱 Your roadmap may need a reset" : "📊 Your Weekly Progress Report",
      message: needsSupport
        ? `You completed ${completedCount} of ${plannedCount} scheduled tasks this week. Try one small task today, or adjust your study time in your roadmap.`
        : `You completed ${completedCount} of ${plannedCount} scheduled task(s) this week. Current Employability Score: ${currentScore}/100.`,
      category: "system",
      actionUrl: "/student/employability",
    });

    // 4. Send Email Summary
    await sendSystemEmail({
      to: student.user.email,
      subject: `Weekly Performance Digest | UPSHIFT CAREER`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
          <h2>Your Weekly Progress Snapshot</h2>
          <p>Hi ${student.user.name}, here is your weekly accomplishment summary:</p>
          <ul style="list-style-type: none; padding-left: 0;">
            <li style="margin-bottom: 8px;">✅ <strong>Completed Tasks:</strong> ${completedCount} of ${plannedCount} scheduled</li>
            <li style="margin-bottom: 8px;">🔥 <strong>Active Streak:</strong> ${student.streak} Days</li>
            <li style="margin-bottom: 8px;">📈 <strong>Employability Score:</strong> ${currentScore} / 100</li>
            <li style="margin-bottom: 8px;">🎯 <strong>Target Role:</strong> ${student.targetRole || "Software Engineer"}</li>
          </ul>
          <p>${needsSupport ? "It looks like this week's plan may have been hard to fit in. Choose one small task to restart, or adjust your available study time in your roadmap." : "Review your custom curriculum and step into the new week with focus."}</p>
          <a href="${process.env.APP_BASE_URL || "http://localhost:8090"}/student/dashboard"
             style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
             Open Dashboard
          </a>
        </div>
      `,
    });
  }

  console.log(`✅ [Job: WeeklyProgress] Reports delivered to ${students.length} student(s).`);
};

module.exports = weeklyProgressJob;
