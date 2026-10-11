const express = require("express");
const router = express.Router();
const recruiterController = require("../controllers/recruiterController");
const requireAuth = require("../middlewares/requireAuth");
const requireRole = require("../middlewares/requireRole");
const recruiterEngagementController = require("../controllers/recruiterEngagementController");
const { apiLimiter } = require("../middlewares/rateLimiter");

router.use(requireAuth, requireRole("recruiter"));

router.get("/", (req, res) => res.redirect("/recruiter/dashboard"));
router.get("/dashboard", recruiterController.getDashboard);
router.get("/manage-jobs", recruiterController.getManageJobs);
router.get("/post-job", recruiterController.renderPostJob);
router.post("/jobs", recruiterController.createJob);
router.get("/candidates", recruiterController.searchCandidates);
router.get("/candidate-search", recruiterController.searchCandidates);
router.get("/candidate/:studentId", recruiterController.getCandidate);
router.get("/candidate/:studentId/messages", recruiterEngagementController.openCandidateConversation);
router.post("/candidate/:studentId/offers", apiLimiter, recruiterEngagementController.makeOffer);
router.post("/candidate/:studentId/interviews", apiLimiter, recruiterEngagementController.scheduleInterview);
router.get("/messages", recruiterEngagementController.getRecruiterInbox);
router.get("/messages/:conversationId", recruiterEngagementController.openRecruiterConversation);
router.post("/messages/:conversationId", apiLimiter, recruiterEngagementController.sendRecruiterMessage);
router.post("/interviews/:interviewId/cancel", apiLimiter, recruiterEngagementController.cancelInterview);
router.get("/jobs/:jobId/applicants", recruiterController.getJobApplicants);
router.get("/applications/:applicationId", recruiterController.getApplication);

module.exports = router;
