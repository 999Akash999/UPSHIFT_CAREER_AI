const Project = require("../models/Project");
const { recalculateAfterActivity } = require("../services/employabilityService");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const parseProjectInput = (body = {}) => {
  const { title, description, techStack, githubUrl, liveDemoUrl } = body;
  const cleanTitle = String(title || "").trim();
  const cleanDescription = String(description || "").trim();
  const parsedTechStack = Array.isArray(techStack)
    ? techStack.map((tech) => String(tech).trim()).filter(Boolean)
    : String(techStack || "").split(",").map((tech) => tech.trim()).filter(Boolean);
  const uniqueTechStack = [...new Set(parsedTechStack.map((tech) => tech.slice(0, 50)))].slice(0, 30);

  if (cleanTitle.length < 2 || cleanTitle.length > 120) throw new Error("Project title must be between 2 and 120 characters.");
  if (cleanDescription.length < 10 || cleanDescription.length > 3000) throw new Error("Project description must be between 10 and 3000 characters.");
  if (!uniqueTechStack.length) throw new Error("Add at least one technology used in this project.");

  return {
    title: cleanTitle,
    description: cleanDescription,
    techStack: uniqueTechStack,
    githubUrl: cleanOptionalUrl(githubUrl, "GitHub URL"),
    liveDemoUrl: cleanOptionalUrl(liveDemoUrl, "Live demo URL"),
  };
};

const isValidationError = (error) => error.message?.startsWith("Project ")
  || error.message?.startsWith("Add at least")
  || error.message?.includes("URL");

const unlinkProjectImage = async (imageUrl) => {
  const prefix = "/uploads/projects/";
  if (!String(imageUrl || "").startsWith(prefix)) return;
  const filename = path.basename(imageUrl.slice(prefix.length));
  if (!filename) return;
  await fs.promises.unlink(path.join(__dirname, "..", "uploads", "projects", filename)).catch(() => {});
};

const findOwnedProject = async (projectId, studentId) => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) return null;
  return Project.findOne({ _id: projectId, student: studentId });
};

const refreshEmployability = async (studentId) => {
  try {
    await recalculateAfterActivity(studentId);
  } catch (error) {
    // The project change is already persisted; a secondary score refresh must
    // not make the UI report that the save itself failed.
    console.error("Project saved, but employability refresh failed:", error.message);
  }
};

const cleanOptionalUrl = (value, label) => {
  const url = String(value || "").trim();
  if (!url) return "";

  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    throw new Error(`${label} must be a valid URL starting with https://`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${label} must use http:// or https://`);
  }
  return parsed.toString();
};

exports.submitProject = async (req, res) => {
  let projectCreated = false;
  try {
    const projectDetails = parseProjectInput(req.body);
    const project = await Project.create({
      // Project.student intentionally references the User record, not Student.
      student: req.student.user || req.user._id,
      ...projectDetails,
      imageUrl: req.file ? `/uploads/projects/${path.basename(req.file.filename)}` : "",
    });
    projectCreated = true;
    await refreshEmployability(req.student._id);
    if (req.accepts("json")) {
      return res.status(201).json({ success: true, message: "Project added to your portfolio.", project });
    }
    req.flash("success", "Project saved to your portfolio. It will show as verified after review.");
    return res.redirect(303, "/student/projects");
  } catch (err) {
    if (!projectCreated && req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
    console.error("Project submission failed:", err);
    const status = isValidationError(err) ? 400 : 500;
    const message = status === 400 ? err.message : "Could not save the project. Please try again.";
    if (req.accepts("json")) return res.status(status).json({ success: false, error: message });
    req.flash("error", message);
    return res.redirect(303, "/student/projects");
  }
};

exports.updateProject = async (req, res) => {
  let saved = false;
  try {
    const project = await findOwnedProject(req.params.projectId, req.user._id);
    if (!project) return res.status(404).json({ success: false, error: "Project not found." });

    const projectDetails = parseProjectInput(req.body);
    const previousImage = project.imageUrl;
    Object.assign(project, projectDetails);
    project.isVerified = false;
    if (req.file) project.imageUrl = `/uploads/projects/${path.basename(req.file.filename)}`;
    await project.save();
    saved = true;

    if (req.file && previousImage) await unlinkProjectImage(previousImage);
    await refreshEmployability(req.student._id);
    if (req.accepts("json")) return res.json({ success: true, message: "Project updated.", project });
    req.flash("success", "Project updated.");
    return res.redirect(303, "/student/projects");
  } catch (error) {
    if (!saved && req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
    console.error("Project update failed:", error);
    const status = isValidationError(error) ? 400 : 500;
    const message = status === 400 ? error.message : "Could not update this project. Please try again.";
    if (req.accepts("json")) return res.status(status).json({ success: false, error: message });
    req.flash("error", message);
    return res.redirect(303, "/student/projects");
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const project = await findOwnedProject(req.params.projectId, req.user._id);
    if (!project) return res.status(404).json({ success: false, error: "Project not found." });
    const imageUrl = project.imageUrl;
    await project.deleteOne();
    await unlinkProjectImage(imageUrl);
    await refreshEmployability(req.student._id);
    if (req.accepts("json")) return res.json({ success: true, message: "Project deleted." });
    req.flash("success", "Project deleted.");
    return res.redirect(303, "/student/projects");
  } catch (error) {
    console.error("Project deletion failed:", error);
    if (req.accepts("json")) return res.status(500).json({ success: false, error: "Could not delete this project. Please try again." });
    req.flash("error", "Could not delete this project. Please try again.");
    return res.redirect(303, "/student/projects");
  }
};
