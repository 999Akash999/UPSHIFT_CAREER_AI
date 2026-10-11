const express = require("express");
const applicationController = require("../controllers/applicationController");
const requireAuth = require("../middlewares/requireAuth");

const router = express.Router();
router.get("/:ownerId/resume/:filename", requireAuth, applicationController.downloadResume);

module.exports = router;
