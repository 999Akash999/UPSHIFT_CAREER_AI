const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const Company = require("../models/Company");
const AIConversation = require("../models/AIConversation");
const InterviewSession = require("../models/InterviewSession");
const Roadmap = require("../models/Roadmap");
const AI_CONFIG = require("../config/aiConfig");

exports.getDashboard = async (req, res) => {
  const userCount = await User.countDocuments();
  const students = await User.countDocuments({ role: "student" });
  const recruiters = await User.countDocuments({ role: "recruiter" });
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(20);

  res.render("admin/dashboard", {
    title: "Admin Governance",
    stats: { userCount, students, recruiters },
    logs,
  });
};

exports.updateUserRole = async (req, res) => {
  try {
    const { userId, newRole } = req.body;
    const allowedRoles = ["student", "recruiter", "mentor", "alumni", "admin"];
    if (!allowedRoles.includes(newRole)) throw new Error("Invalid user role.");
    const updatedUser = await User.findByIdAndUpdate(userId, { role: newRole }, { new: true, runValidators: true });
    if (!updatedUser) throw new Error("User not found.");
    await AuditLog.create({
      action: "USER_ROLE_CHANGE",
      performedBy: req.user._id,
      targetId: updatedUser._id,
      targetModel: "User",
      ipAddress: req.ip,
      details: { message: `Changed role to ${newRole}` },
    });
    req.flash("success", "User role updated.");
    res.redirect("/admin/users");
  } catch (err) {
    req.flash("error", "Failed to update role.");
    res.redirect("/admin/users");
  }
};

exports.getUsers = async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(200);
  res.render("admin/users", { title: "Manage Users", users });
};

exports.getCompanies = async (req, res) => {
  const companies = await Company.find().sort({ createdAt: -1 });
  res.render("admin/companies", { title: "Companies", companies });
};

exports.getAuditLogs = async (req, res) => {
  const logs = await AuditLog.find().populate("performedBy", "name email").sort({ createdAt: -1 }).limit(200);
  res.render("admin/audit-logs", { title: "Audit Logs", logs });
};

exports.getAIAnalytics = async (req, res) => {
  const [conversationStats, interviewStats, roadmapCount] = await Promise.all([
    AIConversation.aggregate([
      { $unwind: { path: "$messages", preserveNullAndEmptyArrays: true } },
      { $group: {
        _id: "$type",
        prompts: { $sum: { $cond: [{ $eq: ["$messages.role", "user"] }, 1, 0] } },
        replies: { $sum: { $cond: [{ $eq: ["$messages.role", "assistant"] }, 1, 0] } },
      } },
    ]),
    InterviewSession.aggregate([
      { $unwind: "$transcript" },
      { $count: "evaluations" },
    ]),
    Roadmap.countDocuments(),
  ]);
  const metrics = {
    model: AI_CONFIG.model,
    configured: AI_CONFIG.isConfigured,
    tutorPrompts: conversationStats.find((row) => row._id === "tutor")?.prompts || 0,
    coachPrompts: conversationStats.find((row) => row._id === "coach")?.prompts || 0,
    interviewEvaluations: interviewStats[0]?.evaluations || 0,
    roadmapsGenerated: roadmapCount,
  };
  res.render("admin/ai-analytics", { title: "AI Activity", metrics });
};

exports.verifyCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.companyId, { isVerified: true }, { new: true });
    if (!company) return res.status(404).render("errors/404", { title: "Company not found" });
    await AuditLog.create({
      action: "COMPANY_VERIFICATION",
      performedBy: req.user._id,
      targetId: company._id,
      targetModel: "Company",
      ipAddress: req.ip,
      details: { companyName: company.name },
    });
    req.flash("success", "Company verified.");
    res.redirect("/admin/companies");
  } catch (err) {
    req.flash("error", "Could not verify company.");
    res.redirect("/admin/companies");
  }
};
