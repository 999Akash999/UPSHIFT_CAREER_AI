// routes/dailyTaskRoutes.js
const express = require("express");
const router = express.Router();
const dailyTaskController = require("../controllers/dailyTaskController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");
const workspaceController = require("../controllers/studentWorkspaceController");
const { apiLimiter } = require("../middlewares/rateLimiter");

router.use(requireAuth, requireStudent);

router.get("/", workspaceController.getDailyTasks);
router.post("/save", apiLimiter, dailyTaskController.saveTasks);
router.patch("/:id/toggle", apiLimiter, dailyTaskController.toggleTask);

module.exports = router;
