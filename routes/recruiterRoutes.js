const express = require("express");
const router = express.Router();
const recruiterController = require("../controllers/recruiterController");
const requireAuth = require("../middlewares/requireAuth");
const requireRole = require("../middlewares/requireRole");

router.use(requireAuth, requireRole("recruiter"));

router.get("/", (req, res) => res.redirect("/recruiter/dashboard"));
router.get("/dashboard", recruiterController.getDashboard);
router.get("/manage-jobs", recruiterController.getManageJobs);
router.get("/post-job", recruiterController.renderPostJob);
router.post("/jobs", recruiterController.createJob);
router.get("/candidates", recruiterController.searchCandidates);
router.get("/candidate-search", recruiterController.searchCandidates);
router.get("/candidate/:studentId", recruiterController.getCandidate);
router.get("/jobs/:jobId/applicants", recruiterController.getJobApplicants);
router.get("/applications/:applicationId", recruiterController.getApplication);

module.exports = router;
