// routes/companyRoutes.js
const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const requireAuth = require("../middlewares/requireAuth");
const requireRole = require("../middlewares/requireRole");

router.get("/:id", companyController.getCompany);
router.post("/", requireAuth, requireRole("recruiter", "admin"), companyController.registerCompany);

module.exports = router;
