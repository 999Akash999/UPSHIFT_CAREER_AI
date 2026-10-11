const Student = require("../models/Student");
const { getDayBoundsIST } = require("../utils/timeHelpers");

// Award at most one streak day per IST calendar day, regardless of how many
// tasks or practice questions the learner completes.
const recordStudentActivity = async (studentId, activityAt = new Date()) => {
  const student = await Student.findById(studentId);
  if (!student) return null;

  const today = getDayBoundsIST(activityAt).start;
  const lastDay = student.lastActivityDate ? getDayBoundsIST(student.lastActivityDate).start : null;
  if (lastDay?.getTime() === today.getTime()) return student;

  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  student.streak = lastDay?.getTime() === yesterday.getTime() ? (student.streak || 0) + 1 : 1;
  student.lastActivityDate = activityAt;
  await student.save();
  return student;
};

const recordDsaPractice = async (studentId, activityAt = new Date()) => {
  const student = await Student.findById(studentId);
  if (!student) return null;

  const today = getDayBoundsIST(activityAt).start;
  const lastDay = student.dsaLastPracticeDate ? getDayBoundsIST(student.dsaLastPracticeDate).start : null;
  if (lastDay?.getTime() === today.getTime()) return student;

  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  student.dsaStreak = lastDay?.getTime() === yesterday.getTime() ? (student.dsaStreak || 0) + 1 : 1;
  student.dsaBestStreak = Math.max(student.dsaBestStreak || 0, student.dsaStreak);
  student.dsaLastPracticeDate = activityAt;
  await student.save();
  return student;
};

module.exports = { recordStudentActivity, recordDsaPractice };
