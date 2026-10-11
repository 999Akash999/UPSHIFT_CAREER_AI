const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");
const workspaceController = require("../controllers/studentWorkspaceController");
const aiCoachController = require("../controllers/aiCoachController");
const interviewController = require("../controllers/interviewController");
const upload = require("../middlewares/upload");
const resumeBuilderController = require("../controllers/resumeBuilderController");
const { aiLimiter, apiLimiter } = require("../middlewares/rateLimiter");
const recruiterEngagementController = require("../controllers/recruiterEngagementController");

router.use(requireAuth, requireStudent);

router.get("/dashboard", studentController.getDashboard);
router.get("/", (req, res) => res.redirect("/student/dashboard"));
router.get("/profile", studentController.getProfile);
const uploadAvatar = (req, res, next) => upload.single("avatar")(req, res, (error) => {
  if (error) {
    if (req.xhr || String(req.get("accept") || "").includes("application/json")) {
      return res.status(error.status || 400).json({ success: false, error: error.message || "Profile photo upload failed. Please use a JPG, PNG, or WEBP image under 5 MB." });
    }
    req.flash("error", error.message || "Profile photo upload failed. Please use a JPG, PNG, or WEBP image under 5 MB.");
    return res.redirect("/student/profile");
  }
  next();
});
router.post("/profile", uploadAvatar, studentController.updateProfile);
router.get("/resume-builder", resumeBuilderController.renderBuilder);
router.post("/resume-builder/generate", aiLimiter, resumeBuilderController.generate);
router.get("/daily-tasks", workspaceController.getDailyTasks);
router.get("/skill-gap", workspaceController.getSkillGap);
router.get("/employability", workspaceController.getEmployability);
router.get("/ai-coach", aiCoachController.renderCoach);
router.get("/interview", interviewController.renderInterview);
router.get("/applications", workspaceController.getApplications);
router.get("/messages", recruiterEngagementController.getStudentInbox);
router.get("/messages/:conversationId", recruiterEngagementController.openStudentConversation);
router.post("/messages/:conversationId", apiLimiter, recruiterEngagementController.sendStudentMessage);
router.get("/interviews/:interviewId/messages", recruiterEngagementController.openStudentInterviewConversation);
router.post("/interviews/:interviewId/respond", apiLimiter, recruiterEngagementController.respondToInterview);
router.get("/doubts", workspaceController.getDoubts);
router.get("/doubts/:id", workspaceController.getDoubt);
router.get("/mentorship", workspaceController.getMentorship);
router.get("/mentorship/book/:mentorId", workspaceController.getMentorshipBooking);
router.get("/my-courses", workspaceController.getMyCourses);

module.exports = router;
