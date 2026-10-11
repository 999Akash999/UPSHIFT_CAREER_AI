// routes/settingsRoutes.js
const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");
const requireAuth = require("../middlewares/requireAuth");

router.use(requireAuth);

router.get("/", settingsController.renderSettings);
router.post("/password", settingsController.updatePassword);

module.exports = router;