// routes/learningResourceRoutes.js
const express = require("express");
const router = express.Router();
const learningResourceController = require("../controllers/learningResourceController");
const requireAuth = require("../middlewares/requireAuth");

router.get("/", requireAuth, learningResourceController.getResources);

module.exports = router;