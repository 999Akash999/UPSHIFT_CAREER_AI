const Assessment = require("../models/Assessment");
const skillAssessmentBank = require("../data/skillAssessmentBank");
const AlumniEvent = require("../models/AlumniEvent");
const EventRegistration = require("../models/EventRegistration");
const DailyTask = require("../models/DailyTask");
const Doubt = require("../models/Doubt");
const Job = require("../models/Job");
const JobApplication = require("../models/JobApplication");
const MentorProfile = require("../models/MentorProfile");
const Project = require("../models/Project");
const Student = require("../models/Student");
const { calculateEmployability } = require("../services/employabilityService");
const { getDateKeyIST, getDayBoundsIST } = require("../utils/timeHelpers");

exports.getDailyTasks = async (req, res) => {
  const { start, end } = getDayBoundsIST();
  let tasks = [];
  let tasksError = "";
  let snapshot = { overallScore: 0 };
  try {
    tasks = await DailyTask.find({ student: req.student._id, dueDate: { $gte: start, $lt: end } }).sort({ isCompleted: 1, dueDate: 1 });
  } catch (error) {
    console.error("Daily tasks could not be loaded:", error);
    tasksError = "Your tasks could not be loaded right now. Please refresh in a moment.";
  }
  // Employability is a supplemental card; a score refresh problem should not
  // prevent students from seeing or updating their daily tasks.
  try {
    snapshot = await calculateEmployability(req.student._id);
  } catch (error) {
    console.error("Daily tasks employability summary unavailable:", error.message);
  }
  const student = req.student;
  const todayKey = getDateKeyIST(start);
  const yesterdayKey = getDateKeyIST(new Date(start.getTime() - 24 * 60 * 60 * 1000));
  const lastActivityKey = student?.lastActivityDate ? getDateKeyIST(student.lastActivityDate) : null;
  const activeToday = lastActivityKey === todayKey;
  const currentStreak = [todayKey, yesterdayKey].includes(lastActivityKey) ? student?.streak || 0 : 0;
  res.render("student/daily-tasks", { title: "Daily Tasks", tasks, student, currentStreak, activeToday, employabilityScore: snapshot?.overallScore || 0, tasksError });
};

exports.getSkillGap = async (req, res) => {
  const student = await Student.findById(req.student._id);
  res.render("student/skill-gap", { title: "Skill Gap Analysis", student, topGaps: student.identifiedGaps || [] });
};

exports.getEmployability = async (req, res) => {
  const snapshot = await calculateEmployability(req.student._id);
  res.render("student/employability", { title: "Employability Score", snapshot });
};

exports.getAssessments = async (req, res) => {
  const assessments = await Assessment.find({
    isPublished: true,
    title: { $in: skillAssessmentBank.map((item) => item.title) },
  }).sort({ createdAt: 1 });
  res.render("student/assessments", { title: "Skill Assessments", assessments });
};

exports.getProjects = async (req, res) => {
  const projects = await Project.find({ student: req.user._id }).sort({ createdAt: -1 });
  res.render("student/projects", { title: "My Projects", projects });
};

exports.getApplications = async (req, res) => {
  const applications = await JobApplication.find({ student: req.user._id })
    .populate({ path: "job", populate: { path: "company" } })
    .sort({ createdAt: -1 });
  res.render("student/applications", { title: "My Applications", applications });
};

exports.getDoubts = async (req, res) => {
  const doubts = await Doubt.find().sort({ createdAt: -1 }).limit(100);
  res.render("student/doubts", { title: "Community Doubts", doubts });
};

exports.getDoubt = async (req, res) => {
  const doubt = await Doubt.findById(req.params.id).populate("author", "name").populate("replies.author", "name");
  if (!doubt) return res.status(404).render("errors/404", { title: "Question not found" });
  res.render("student/doubt-show", { title: doubt.title, doubt });
};

exports.getEvents = async (req, res) => {
  const now = new Date();
  let events;
  try {
    events = await AlumniEvent.find({ scheduledAt: { $gte: now } }).sort({ scheduledAt: 1 });
  } catch (error) {
    console.error("Upcoming events could not be loaded:", error);
    return res.status(200).render("student/events", {
      title: "Events and Webinars", events: [], attendedEvents: [], registeredEventIds: new Set(),
      eventsError: "Events are temporarily unavailable. Please refresh in a moment.",
    });
  }

  let registrations = [];
  let attendedRegistrations = [];
  let registrationError = "";
  try {
    [registrations, attendedRegistrations] = await Promise.all([
      EventRegistration.find({ user: req.user._id }).select("event"),
      EventRegistration.find({ user: req.user._id, attended: true })
        .populate({ path: "event", match: { scheduledAt: { $lt: now } } })
        .sort({ updatedAt: -1 }),
    ]);
  } catch (error) {
    console.error("Event registration status could not be loaded:", error);
    registrationError = "Your RSVP and attendance status could not be loaded. You can still browse events.";
  }
  const registeredEventIds = new Set(registrations.map((registration) => String(registration.event)));
  const attendedEvents = attendedRegistrations.map((registration) => registration.event).filter(Boolean);
  res.render("student/events", { title: "Events and Webinars", events, attendedEvents, registeredEventIds, eventsError: registrationError });
};

exports.getMentorship = async (req, res) => {
  const mentors = await MentorProfile.find().populate("user", "name").sort({ rating: -1 });
  res.render("student/mentorship", { title: "Mentorship", mentors });
};

exports.getMentorshipBooking = async (req, res) => {
  const mentor = await MentorProfile.findById(req.params.mentorId).populate("user", "name");
  if (!mentor) return res.status(404).render("errors/404", { title: "Mentor not found" });
  res.render("student/mentorship-book", { title: "Book a Mentor", mentor });
};

exports.getMyCourses = async (req, res) => {
  const student = await Student.findById(req.student._id).populate("enrolledCourses");
  const enrolledCourses = (student.enrolledCourses || []).filter(Boolean);
  res.render("student/my-courses", { title: "My Courses", enrolledCourses });
};

exports.getJob = async (req, res) => {
  const job = await Job.findOne({ _id: req.params.jobId, status: "active" }).populate("company");
  if (!job) return res.status(404).render("errors/404", { title: "Job not found" });
  const existingApplication = await JobApplication.exists({ job: job._id, student: req.user._id });
  res.render("student/job-detail", { title: job.title, job, existingApplication: Boolean(existingApplication) });
};

