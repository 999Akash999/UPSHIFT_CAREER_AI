const express = require("express");
const router = express.Router();
const mentorController = require("../controllers/mentorController");
const requireAuth = require("../middlewares/requireAuth");
const requireRole = require("../middlewares/requireRole");
const { apiLimiter } = require("../middlewares/rateLimiter");

// Mentor Management Portal
router.get("/", requireAuth, requireRole("mentor"), (req, res) => res.redirect("/mentor/dashboard"));
router.get("/dashboard", requireAuth, requireRole("mentor"), mentorController.getDashboard);
router.get("/slots", requireAuth, requireRole("mentor"), mentorController.getSlots);
router.get("/sessions", requireAuth, requireRole("mentor"), mentorController.getSessions);
router.get("/courses", requireAuth, requireRole("mentor"), mentorController.getCourses);
router.get("/courses/new", requireAuth, requireRole("mentor"), mentorController.getNewCourse);
router.post("/courses", requireAuth, requireRole("mentor"), apiLimiter, mentorController.createCourse);
router.post("/courses/:courseId/toggle-publish", requireAuth, requireRole("mentor"), apiLimiter, mentorController.toggleCoursePublication);
router.post("/availability", requireAuth, requireRole("mentor"), apiLimiter, mentorController.updateAvailability);

// Student booking endpoint
router.post("/book", requireAuth, requireRole("student"), mentorController.bookSession);

module.exports = router;
