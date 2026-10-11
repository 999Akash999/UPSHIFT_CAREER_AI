const MentorshipBooking = require("../models/MentorshipBooking");
const EventRegistration = require("../models/EventRegistration");
const AlumniEvent = require("../models/AlumniEvent");
const { sendNotification } = require("../services/notificationService");
const { sendSystemEmail } = require("../services/emailService");

const deadlineReminderJob = async () => {
  console.log("⚡ [Job: DeadlineReminder] Scanning upcoming events & sessions within 24 hours...");

  const now = new Date();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // 1. Mentorship Sessions within 24 hours
  const upcomingBookings = await MentorshipBooking.find({
    sessionDate: { $gte: now,$lte: next24Hours },
    status: "confirmed",
    reminderSentAt: null,
  })
    .populate("mentor", "name email")
    .populate("student", "name email");

  for (const booking of upcomingBookings) {
    if (!booking.student || !booking.mentor) continue;
    const claimed = await MentorshipBooking.findOneAndUpdate(
      { _id: booking._id, reminderSentAt: null },
      { $set: { reminderSentAt: now } },
      { new: true }
    );
    if (!claimed) continue;

    const timeString = new Date(booking.sessionDate).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Notify Student
    await sendNotification({
      recipientId: booking.student._id,
      title: "🗓️ Upcoming Mentorship Session",
      message: `Session with ${booking.mentor.name} starts at ${timeString}. Be prepared with questions!`,
      category: "mentorship",
      actionUrl: "/student/mentorship",
    });

    // Email Student
    await sendSystemEmail({
      to: booking.student.email,
      subject: `Reminder: Mentorship session with ${booking.mentor.name} today`,
      html: `
        <p>Hi ${booking.student.name},</p>
        <p>Your session with <strong>${booking.mentor.name}</strong> is scheduled for <strong>${booking.sessionDate.toLocaleString()}</strong>.</p>
        <p><strong>Agenda:</strong> ${booking.agenda || "General review"}</p>
        <p>Meeting link: <a href="${booking.meetingLink || "#"}">${booking.meetingLink || "Link will appear in dashboard"}</a></p>
      `,
    });
  }

  // 2. Event Registrations within 24 hours
  const upcomingEvents = await AlumniEvent.find({ scheduledAt: { $gte: now, $lte: next24Hours } }).select("_id");
  const registrations = upcomingEvents.length
    ? await EventRegistration.find({ event: { $in: upcomingEvents.map((event) => event._id) }, reminderSentAt: null })
        .populate("event", "title scheduledAt").populate("user", "name email")
    : [];

  for (const reg of registrations) {
    if (!reg.event || !reg.user) continue;
    const claimed = await EventRegistration.findOneAndUpdate(
      { _id: reg._id, reminderSentAt: null },
      { $set: { reminderSentAt: now } },
      { new: true }
    );
    if (!claimed) continue;

    await sendNotification({
      recipientId: reg.user._id,
      title: `🔔 Event Alert: "${reg.event.title}" is coming up!`,
      message: `The session starts at ${new Date(reg.event.scheduledAt).toLocaleTimeString("en-IN")}. Join on time.`,
      category: "system",
      actionUrl: "/student/events",
    });
  }

  console.log(`✅ [Job: DeadlineReminder] Verified ${upcomingBookings.length} session(s).`);
};

module.exports = deadlineReminderJob;
