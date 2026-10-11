// controllers/courseController.js
const Course = require("../models/Course");
const Student = require("../models/Student");
const LearningActivity = require("../models/LearningActivity");
const { recalculateAfterActivity } = require("../services/employabilityService");

exports.getCatalog = async (req, res) => {
  const courses = await Course.find({ isPublished: true });
  res.render("courses/index", { title: "Upskill Courses | UPSHIFT", courses });
};

exports.getCourseDetails = async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug, isPublished: true }).populate("instructor", "name avatar");
  if (!course) {
    req.flash("error", "Course not found.");
    return res.redirect("/courses");
  }
  res.render("courses/show", { title: course.title, course });
};

exports.learn = async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug, isPublished: true }).populate("instructor", "name");
  if (!course) return res.status(404).render("errors/404", { title: "Course not found" });
  const student = req.student || await Student.findOne({ user: req.user._id });
  const enrolled = student?.enrolledCourses?.some((id) => String(id) === String(course._id));
  const previewOnly = !enrolled;
  const modules = previewOnly
    ? course.modules.map((module) => ({
        ...module.toObject(),
        lessons: module.lessons.filter((lesson) => lesson.isFreePreview),
      })).filter((module) => module.lessons.length)
    : course.modules;
  if (previewOnly && modules.length === 0) {
    req.flash("error", "Enroll in this course to access the lessons.");
    return res.redirect(`/courses/${course.slug}`);
  }
  const completedLessons = student
    ? await LearningActivity.find({ student: student._id, referenceId: course._id, isCompleted: true }).distinct("lessonId")
    : [];
  res.render("courses/learn", { title: course.title, course, modules, previewOnly, completedLessons });
};

exports.completeLesson = async (req, res, next) => {
  try {
    const student = req.student || await Student.findOne({ user: req.user._id });
    const course = await Course.findOne({ slug: req.params.slug, isPublished: true });
    if (!student || !course) return res.status(404).json({ success: false, error: "Course not found." });
    const enrolled = (student.enrolledCourses || []).some((id) => String(id) === String(course._id));
    if (!enrolled) return res.status(403).json({ success: false, error: "Enroll in this course to record lesson progress." });
    const lessons = course.modules.flatMap((module) => module.lessons);
    const lesson = lessons.find((item) => String(item._id) === String(req.params.lessonId));
    if (!lesson) return res.status(404).json({ success: false, error: "Lesson not found." });

    await LearningActivity.findOneAndUpdate(
      { student: student._id, referenceId: course._id, lessonId: String(lesson._id) },
      { $set: { activityType: "video_lesson", onModel: "Course", isCompleted: true }, $setOnInsert: { timeSpentSeconds: 0 } },
      { upsert: true, runValidators: true }
    );
    await recalculateAfterActivity(student._id);
    res.json({ success: true, completed: true });
  } catch (error) {
    next(error);
  }
};
