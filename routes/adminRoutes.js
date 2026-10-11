const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const requireAuth = require("../middlewares/requireAuth");
const requireRole = require("../middlewares/requireRole");

router.use(requireAuth, requireRole("admin"));

router.get("/", (req, res) => res.redirect("/admin/dashboard"));
router.get("/dashboard", adminController.getDashboard);
router.get("/users", adminController.getUsers);
router.get("/companies", adminController.getCompanies);
router.get("/audit-logs", adminController.getAuditLogs);
router.get("/ai-analytics", adminController.getAIAnalytics);
router.post("/companies/:companyId/verify", adminController.verifyCompany);
router.post("/users/role", adminController.updateUserRole);

module.exports = router;
