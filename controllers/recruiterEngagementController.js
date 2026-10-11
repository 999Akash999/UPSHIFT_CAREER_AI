const mongoose = require("mongoose");
const Student = require("../models/Student");
const Job = require("../models/Job");
const JobApplication = require("../models/JobApplication");
const EmployabilitySnapshot = require("../models/EmployabilitySnapshot");
const RecruiterConversation = require("../models/RecruiterConversation");
const RecruiterInterview = require("../models/RecruiterInterview");
const Notification = require("../models/Notification");
const { getIO } = require("../config/socket");

const redirectWithMessage = (req, res, location, type, message) => {
  req.flash(type, message);
  return res.redirect(location);
};

const emitToUser = (userId, event, payload) => {
  try {
    getIO().to(`user:${userId}`).emit(event, payload);
  } catch (error) {
    // Persisted messages remain available through the inbox if Socket.IO is unavailable.
    console.error("Live recruiter message delivery unavailable:", error.message);
  }
};

const getOrCreateConversation = async ({ recruiterId, studentId, jobId = null }) => {
  try {
    return await RecruiterConversation.findOneAndUpdate(
      { recruiter: recruiterId, student: studentId },
      {
        $setOnInsert: { recruiter: recruiterId, student: studentId, messages: [], lastMessageAt: new Date() },
        ...(jobId ? { $set: { job: jobId } } : {}),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error.code === 11000) return RecruiterConversation.findOne({ recruiter: recruiterId, student: studentId });
    throw error;
  }
};

const renderConversation = async ({ req, res, conversation, currentUser, mode }) => {
  const otherUser = mode === "recruiter" ? conversation.student : conversation.recruiter;
  conversation.messages.forEach((message) => {
    if (String(message.sender?._id || message.sender) !== String(currentUser._id) && !message.readAt) message.readAt = new Date();
  });
  await conversation.save();
  return res.render("shared/conversation", {
    title: `Messages · ${otherUser?.name || "Candidate"}`,
    conversation,
    otherUser,
    currentUser,
    mode,
    backUrl: mode === "recruiter" ? "/recruiter/messages" : "/student/messages",
    replyUrl: mode === "recruiter" ? `/recruiter/messages/${conversation._id}` : `/student/messages/${conversation._id}`,
  });
};

exports.getRecruiterInbox = async (req, res) => {
  const conversations = await RecruiterConversation.find({ recruiter: req.user._id })
    .populate("student", "name email avatar")
    .populate("job", "title")
    .sort({ lastMessageAt: -1 });
  res.render("recruiter/messages", { title: "Candidate Messages", conversations });
};

exports.openCandidateConversation = async (req, res) => {
  const candidate = await Student.findById(req.params.studentId).populate("user", "name email avatar");
  if (!candidate?.user) return res.status(404).render("errors/404", { title: "Candidate not found" });
  const requestedJob = req.query.jobId && mongoose.isValidObjectId(req.query.jobId)
    ? await Job.findOne({ _id: req.query.jobId, recruiter: req.user._id })
    : null;
  const conversation = await getOrCreateConversation({ recruiterId: req.user._id, studentId: candidate.user._id, jobId: requestedJob?._id });
  const populated = await RecruiterConversation.findById(conversation._id)
    .populate("student", "name email avatar")
    .populate("recruiter", "name email avatar")
    .populate("job", "title")
    .populate("messages.sender", "name role avatar");
  return renderConversation({ req, res, conversation: populated, currentUser: req.user, mode: "recruiter" });
};

exports.openRecruiterConversation = async (req, res) => {
  const conversation = await RecruiterConversation.findOne({ _id: req.params.conversationId, recruiter: req.user._id })
    .populate("student", "name email avatar")
    .populate("recruiter", "name email avatar")
    .populate("job", "title")
    .populate("messages.sender", "name role avatar");
  if (!conversation) return res.status(404).render("errors/404", { title: "Conversation not found" });
  return renderConversation({ req, res, conversation, currentUser: req.user, mode: "recruiter" });
};

exports.getStudentInbox = async (req, res) => {
  const conversations = await RecruiterConversation.find({ student: req.user._id })
    .populate("recruiter", "name email avatar")
    .populate("job", "title")
    .sort({ lastMessageAt: -1 });
  res.render("student/messages", { title: "Recruiter Messages", conversations });
};

exports.openStudentConversation = async (req, res) => {
  const conversation = await RecruiterConversation.findOne({ _id: req.params.conversationId, student: req.user._id })
    .populate("student", "name email avatar")
    .populate("recruiter", "name email avatar")
    .populate("job", "title")
    .populate("messages.sender", "name role avatar");
  if (!conversation) return res.status(404).render("errors/404", { title: "Conversation not found" });
  return renderConversation({ req, res, conversation, currentUser: req.user, mode: "student" });
};

exports.openStudentInterviewConversation = async (req, res) => {
  const interview = await RecruiterInterview.findOne({ _id: req.params.interviewId, student: req.user._id });
  if (!interview) return res.status(404).render("errors/404", { title: "Interview not found" });
  const conversation = await getOrCreateConversation({ recruiterId: interview.recruiter, studentId: req.user._id, jobId: interview.job });
  const populated = await RecruiterConversation.findOne({ _id: conversation._id, student: req.user._id })
    .populate("student", "name email avatar")
    .populate("recruiter", "name email avatar")
    .populate("job", "title")
    .populate("messages.sender", "name role avatar");
  return renderConversation({ req, res, conversation: populated, currentUser: req.user, mode: "student" });
};

const postMessage = async (req, res, role) => {
  const limit = role === "recruiter" ? { recruiter: req.user._id } : { student: req.user._id };
  const conversation = await RecruiterConversation.findOne({ _id: req.params.conversationId, ...limit });
  const inbox = role === "recruiter" ? "/recruiter/messages" : "/student/messages";
  if (!conversation) return res.status(404).render("errors/404", { title: "Conversation not found" });
  const body = String(req.body?.body || "").trim();
  if (!body || body.length > 2000) return redirectWithMessage(req, res, `${inbox}/${conversation._id}`, "error", "Message must contain 1 to 2,000 characters.");
  conversation.messages.push({ sender: req.user._id, body });
  conversation.lastMessageAt = new Date();
  await conversation.save();
  const recipient = role === "recruiter" ? conversation.student : conversation.recruiter;
  const senderLabel = String(req.user.name || (role === "recruiter" ? "Recruiter" : "Student")).slice(0, 100);
  emitToUser(recipient, "new:recruiter-message", {
    conversationId: String(conversation._id),
    senderId: String(req.user._id),
    senderName: senderLabel,
    body,
    createdAt: new Date().toISOString(),
  });
  await Notification.create({
    recipient,
    sender: req.user._id,
    title: role === "recruiter" ? "A recruiter sent you a message" : "A candidate replied",
    message: `${senderLabel}: ${body.slice(0, 180)}`,
    category: "message",
    actionUrl: `${role === "recruiter" ? "/student" : "/recruiter"}/messages/${conversation._id}`,
  });
  return redirectWithMessage(req, res, `${inbox}/${conversation._id}`, "success", "Message sent.");
};

exports.sendRecruiterMessage = (req, res) => postMessage(req, res, "recruiter");
exports.sendStudentMessage = (req, res) => postMessage(req, res, "student");

const parseIndianDateTime = (value) => {
  const input = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) return new Date(NaN);
  return new Date(`${input}:00+05:30`);
};

exports.scheduleInterview = async (req, res) => {
  const candidate = await Student.findById(req.params.studentId).populate("user", "name");
  if (!candidate?.user) return res.status(404).render("errors/404", { title: "Candidate not found" });
  const backUrl = `/recruiter/candidate/${candidate._id}`;
  const job = await Job.findOne({ _id: req.body?.jobId, recruiter: req.user._id, status: "active" });
  if (!job) return redirectWithMessage(req, res, backUrl, "error", "Choose one of your active jobs for this interview.");
  const scheduledAt = parseIndianDateTime(req.body?.scheduledAt);
  if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    return redirectWithMessage(req, res, backUrl, "error", "Choose a valid future date and time (India time). ");
  }
  const format = ["video", "phone", "onsite"].includes(req.body?.format) ? req.body.format : "video";
  const locationOrLink = String(req.body?.locationOrLink || "").trim().slice(0, 500);
  const notes = String(req.body?.notes || "").trim().slice(0, 1500);
  if ((format === "video" || format === "onsite") && !locationOrLink) {
    return redirectWithMessage(req, res, backUrl, "error", format === "video" ? "Add the video meeting link." : "Add the interview location.");
  }
  if (format === "video" && !/^https:\/\//i.test(locationOrLink)) {
    return redirectWithMessage(req, res, backUrl, "error", "Use a secure https:// video meeting link.");
  }
  const durationMinutes = [15, 30, 45, 60, 90].includes(Number(req.body?.durationMinutes)) ? Number(req.body.durationMinutes) : 30;
  const application = await JobApplication.findOne({ student: candidate.user._id, job: job._id });
  const interview = await RecruiterInterview.create({
    recruiter: req.user._id,
    student: candidate.user._id,
    job: job._id,
    application: application?._id,
    scheduledAt,
    durationMinutes,
    format,
    locationOrLink,
    notes,
  });
  const conversation = await getOrCreateConversation({ recruiterId: req.user._id, studentId: candidate.user._id, jobId: job._id });
  if (application) {
    application.status = "interviewing";
    application.interviewScheduledDate = scheduledAt;
    await application.save();
  }
  await Notification.create({
    recipient: candidate.user._id,
    sender: req.user._id,
    title: "Interview invitation",
    message: `${job.title} interview on ${scheduledAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}. Please review the details and respond.`,
    category: "interview",
    actionUrl: `/student/messages/${conversation._id}`,
  });
  return redirectWithMessage(req, res, backUrl, "success", `Interview invitation sent to ${candidate.user.name}.`);
};

exports.respondToInterview = async (req, res) => {
  const status = req.body?.status;
  if (!["accepted", "declined"].includes(status)) return res.status(400).json({ success: false, error: "Choose accept or decline." });
  const interview = await RecruiterInterview.findOne({ _id: req.params.interviewId, student: req.user._id, status: "scheduled" }).populate("job", "title");
  if (!interview) return res.status(404).json({ success: false, error: "This interview invitation is no longer available." });
  interview.status = status;
  interview.respondedAt = new Date();
  await interview.save();
  const conversation = await getOrCreateConversation({ recruiterId: interview.recruiter, studentId: req.user._id, jobId: interview.job?._id || interview.job });
  await Notification.create({
    recipient: interview.recruiter,
    sender: req.user._id,
    title: status === "accepted" ? "Interview confirmed" : "Interview declined",
    message: `${req.user.name} ${status} the ${interview.job?.title || "job"} interview invitation.`,
    category: "interview",
    actionUrl: `/recruiter/messages/${conversation._id}`,
  });
  return res.json({ success: true, status: interview.status });
};

exports.cancelInterview = async (req, res) => {
  const interview = await RecruiterInterview.findOne({ _id: req.params.interviewId, recruiter: req.user._id, status: { $in: ["scheduled", "accepted"] } }).populate("job", "title");
  if (!interview) return res.status(404).json({ success: false, error: "Interview not found or already closed." });
  interview.status = "cancelled";
  await interview.save();
  await Notification.create({
    recipient: interview.student,
    sender: req.user._id,
    title: "Interview cancelled",
    message: `The ${interview.job?.title || "job"} interview invitation was cancelled by the recruiter.`,
    category: "interview",
    actionUrl: "/student/applications",
  });
  return res.json({ success: true, status: interview.status });
};

exports.makeOffer = async (req, res) => {
  const candidate = await Student.findById(req.params.studentId).populate("user", "name");
  if (!candidate?.user) return res.status(404).render("errors/404", { title: "Candidate not found" });
  const backUrl = `/recruiter/candidate/${candidate._id}`;
  const job = await Job.findOne({ _id: req.body?.jobId, recruiter: req.user._id, status: "active" });
  if (!job) return redirectWithMessage(req, res, backUrl, "error", "Choose one of your active jobs before sending an offer.");
  let application = await JobApplication.findOne({ student: candidate.user._id, job: job._id });
  if (application && ["offer-accepted", "offer-declined", "rejected", "withdrawn"].includes(application.status)) {
    return redirectWithMessage(req, res, backUrl, "error", "This candidate already has a closed hiring decision for that job.");
  }
  if (!application) {
    const snapshot = await EmployabilitySnapshot.findOne({ student: candidate._id }).sort({ createdAt: -1 });
    application = new JobApplication({
      student: candidate.user._id,
      job: job._id,
      resumeUrl: "",
      coverNote: "Direct recruiter offer",
      employabilityScoreAtApplication: snapshot?.overallScore || 0,
      status: "offered",
    });
  } else {
    application.status = "offered";
  }
  await application.save();
  const conversation = await getOrCreateConversation({ recruiterId: req.user._id, studentId: candidate.user._id, jobId: job._id });
  await Notification.create({
    recipient: candidate.user._id,
    sender: req.user._id,
    title: "Job offer received",
    message: `You received an offer for ${job.title}. Review it in My Applications and reply to the recruiter in Messages.`,
    category: "offer",
    actionUrl: `/student/messages/${conversation._id}`,
  });
  return redirectWithMessage(req, res, backUrl, "success", `Offer sent to ${candidate.user.name} for ${job.title}.`);
};

exports.respondToOffer = async (req, res) => {
  const status = req.body?.status;
  if (!["offer-accepted", "offer-declined"].includes(status)) return res.status(400).json({ success: false, error: "Choose accept or decline." });
  const application = await JobApplication.findOne({ _id: req.params.applicationId, student: req.user._id, status: "offered" })
    .populate({ path: "job", select: "title recruiter" });
  if (!application) return res.status(404).json({ success: false, error: "This offer is no longer available." });
  application.status = status;
  await application.save();
  const conversation = await getOrCreateConversation({ recruiterId: application.job.recruiter, studentId: req.user._id, jobId: application.job._id });
  await Notification.create({
    recipient: application.job.recruiter,
    sender: req.user._id,
    title: status === "offer-accepted" ? "Job offer accepted" : "Job offer declined",
    message: `${req.user.name} ${status === "offer-accepted" ? "accepted" : "declined"} the offer for ${application.job.title}.`,
    category: "offer",
    actionUrl: `/recruiter/messages/${conversation._id}`,
  });
  return res.json({ success: true, status: application.status });
};
