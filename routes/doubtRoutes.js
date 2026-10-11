// routes/doubtRoutes.js
const express = require("express");
const router = express.Router();
const doubtController = require("../controllers/doubtController");
const requireAuth = require("../middlewares/requireAuth");
const workspaceController = require("../controllers/studentWorkspaceController");
const { apiLimiter } = require("../middlewares/rateLimiter");

router.use(requireAuth);

router.get("/", workspaceController.getDoubts);
router.get("/:id", workspaceController.getDoubt);
router.post("/", apiLimiter, doubtController.postDoubt);
router.post("/:id/reply", apiLimiter, doubtController.addReply);

module.exports = router;
