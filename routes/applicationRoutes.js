// routes/applicationRoutes.js
const express = require("express");
const router = express.Router();
const applicationController = require("../controllers/applicationController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");
const upload = require("../middlewares/upload");
const workspaceController = require("../controllers/studentWorkspaceController");
const { apiLimiter } = require("../middlewares/rateLimiter");

// Student application submission with resume PDF upload
router.get("/", requireAuth, requireStudent, workspaceController.getApplications);
router.post(
  "/",
  requireAuth,
  requireStudent,
  apiLimiter,
  upload.single("resume"),
  applicationController.applyToJob
);

// Status updates by recruiters
router.patch("/:applicationId/status", requireAuth, apiLimiter, applicationController.updateStatus);
router.post("/:applicationId/status", requireAuth, apiLimiter, applicationController.updateStatus);

module.exports = router;
