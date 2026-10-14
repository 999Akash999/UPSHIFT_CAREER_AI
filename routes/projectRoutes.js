// routes/projectRoutes.js
const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");
const { apiLimiter } = require("../middlewares/rateLimiter");
const upload = require("../middlewares/upload");

const uploadProjectImage = (req, res, next) => upload.single("projectImage")(req, res, (error) => {
  if (!error) return next();
  const message = error.code === "LIMIT_FILE_SIZE"
    ? "Project image must be 5 MB or smaller."
    : error.message || "Project image upload failed. Please use a JPG, PNG, or WEBP image.";
  if (req.accepts("json")) return res.status(error.status || 400).json({ success: false, error: message });
  req.flash("error", message);
  return res.redirect(303, "/student/projects");
});

router.use(requireAuth, requireStudent);

router.get("/", require("../controllers/studentWorkspaceController").getProjects);
router.post("/", apiLimiter, uploadProjectImage, projectController.submitProject);
router.put("/:projectId", apiLimiter, uploadProjectImage, projectController.updateProject);
router.delete("/:projectId", apiLimiter, projectController.deleteProject);

module.exports = router;
