const Project = require("../models/Project");
const { recalculateAfterActivity } = require("../services/employabilityService");

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
  try {
    const { title, description, techStack, githubUrl, liveDemoUrl } = req.body || {};
    const cleanTitle = String(title || "").trim();
    const cleanDescription = String(description || "").trim();
    const parsedTechStack = Array.isArray(techStack)
      ? techStack.map((tech) => String(tech).trim()).filter(Boolean)
      : String(techStack || "").split(",").map((tech) => tech.trim()).filter(Boolean);
    const uniqueTechStack = [...new Set(parsedTechStack.map((tech) => tech.slice(0, 50)))].slice(0, 30);

    if (cleanTitle.length < 2 || cleanTitle.length > 120) {
      throw new Error("Project title must be between 2 and 120 characters.");
    }
    if (cleanDescription.length < 10 || cleanDescription.length > 3000) {
      throw new Error("Project description must be between 10 and 3000 characters.");
    }
    if (!uniqueTechStack.length) {
      throw new Error("Add at least one technology used in this project.");
    }

    const project = await Project.create({
      // Project.student intentionally references the User record, not Student.
      student: req.student.user || req.user._id,
      title: cleanTitle,
      description: cleanDescription,
      techStack: uniqueTechStack,
      githubUrl: cleanOptionalUrl(githubUrl, "GitHub URL"),
      liveDemoUrl: cleanOptionalUrl(liveDemoUrl, "Live demo URL"),
    });
    await recalculateAfterActivity(req.student._id);
    if (req.accepts("json")) {
      return res.status(201).json({ success: true, message: "Project added to your portfolio.", project });
    }
    req.flash("success", "Project saved to your portfolio. It will show as verified after review.");
    return res.redirect(303, "/student/projects");
  } catch (err) {
    console.error("Project submission failed:", err);
    const status = err.message?.startsWith("Project ") || err.message?.startsWith("Add at least") || err.message?.includes("URL") ? 400 : 500;
    const message = status === 400 ? err.message : "Could not save the project. Please try again.";
    if (req.accepts("json")) return res.status(status).json({ success: false, error: message });
    req.flash("error", message);
    return res.redirect(303, "/student/projects");
  }
};
