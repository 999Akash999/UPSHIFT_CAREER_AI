// routes/eventRoutes.js
const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");
const workspaceController = require("../controllers/studentWorkspaceController");
const { apiLimiter } = require("../middlewares/rateLimiter");

router.use(requireAuth, requireStudent);

router.get("/", workspaceController.getEvents);
router.post("/:eventId/register", apiLimiter, eventController.registerForEvent);

module.exports = router;
