// routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const requireAuth = require("../middlewares/requireAuth");

router.use(requireAuth);

router.get("/", notificationController.getNotifications);
router.get("/preview", notificationController.getPreview);
router.patch("/read-all", notificationController.markAllAsRead);
router.patch("/:id/read", notificationController.markAsRead);

module.exports = router;
