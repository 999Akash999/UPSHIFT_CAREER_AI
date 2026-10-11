const express = require("express");
const courseController = require("../controllers/courseController");
const Course = require("../models/Course");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");
const { apiLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

router.get("/", courseController.getCatalog);
router.get("/:slug/learn", requireAuth, requireStudent, courseController.learn);
router.post("/:slug/lessons/:lessonId/complete", requireAuth, requireStudent, apiLimiter, courseController.completeLesson);
router.get("/:slug", courseController.getCourseDetails);
router.get("/:slug/checkout", requireAuth, requireStudent, async (req, res, next) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug, isPublished: true });
    if (!course) return res.status(404).render("errors/404", { title: "Course not found" });
    res.render("courses/checkout", {
      title: `Checkout | ${course.title}`,
      course,
      razorpayKey: process.env.RAZORPAY_KEY_ID || "",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
