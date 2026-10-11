const Student = require("../models/Student");
const { sendNotification } = require("./notificationService");
const { sendSystemEmail } = require("./emailService");

const checkInactivityAndAlert = async () => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const inactiveStudents = await Student.find({
    lastActivityDate: { $lt: oneDayAgo },
    streak: { $gt: 0 },
  }).populate("user");

  for (const student of inactiveStudents) {
    if (!student.user) continue;

    await sendNotification({
      recipientId: student.user._id,
      title: "🔥 Keep your streak alive!",
      message: `You are about to lose your ${student.streak}-day streak. Complete today's learning task now.`,
      category: "streak",
      actionUrl: "/student/daily-tasks",
    });

    await sendSystemEmail({
      to: student.user.email,
      subject: `Don't break your ${student.streak}-day streak on UPSHIFT CAREER!`,
      html: `<h2>Keep the momentum going!</h2><p>Hey ${student.user.name}, you haven't checked off today's milestones yet. Log in to keep your streak intact.</p>`,
    });
  }
};

module.exports = { checkInactivityAndAlert };