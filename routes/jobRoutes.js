// routes/jobRoutes.js
const express = require("express");
const router = express.Router();
const jobController = require("../controllers/jobController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");
const workspaceController = require("../controllers/studentWorkspaceController");

router.get("/", jobController.listJobs);
router.get("/:jobId", requireAuth, requireStudent, workspaceController.getJob);

module.exports = router;
