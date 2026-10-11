const AI_CONFIG = require("../config/aiConfig");
const { generateAIContent } = require("../services/aiService");
const Project = require("../models/Project");

exports.renderBuilder = (req, res) => {
  res.render("student/resume-builder", {
    title: "AI Resume Builder",
    student: req.student,
  });
};

exports.generate = async (req, res) => {
  try {
    if (!AI_CONFIG.isConfigured) {
      return res.status(503).json({ error: "AI resume builder needs GEMINI_API_KEY (or GOOGLE_API_KEY) configured." });
    }

    const fields = ["experience", "projects", "education", "certifications"];
    const details = Object.fromEntries(fields.map((field) => [field, String(req.body[field] || "").trim()]));
    if (!String(req.body.targetRole || "").trim()) {
      return res.status(400).json({ error: "Add the role you are applying for." });
    }
    if ([...Object.values(details), req.body.targetRole, req.body.skills].some((value) => String(value || "").length > 5000)) {
      return res.status(413).json({ error: "Each resume field must be under 5,000 characters." });
    }

    const targetRole = String(req.body.targetRole).trim();
    const skills = String(req.body.skills || "").trim();
    const profileProjects = await Project.find({ student: req.user._id })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("title description techStack githubUrl liveDemoUrl")
      .lean()
      .catch((error) => {
        console.error("Could not load portfolio projects for resume:", error.message);
        return [];
      });
    const result = await generateAIContent({
      jsonMode: true,
      maxTokens: 8000,
      messages: [
        {
          role: "system",
          content: "You are an expert resume writer. Return only valid JSON with keys: headline (string), summary (string), skills (array of strings), experience (array of objects with role, company, duration, bullets array), projects (array of objects with name, technologies, bullets array, githubUrl, liveDemoUrl), education (array of objects with school, degree, year, details), certifications (array of strings). Write concise ATS-friendly English. Use profile and portfolio details supplied below. Never invent employers, dates, metrics, credentials, project outcomes, or achievements. Convert project descriptions into clear factual bullets. Omit empty sections and use empty arrays when no facts were provided. Improve phrasing without changing meaning.",
        },
        {
          role: "user",
          content: JSON.stringify({
            name: req.user.name,
            email: req.user.email,
            targetRole,
            skills,
            education: details.education || `${req.student.academicDetails?.degree || ""} ${req.student.academicDetails?.college || ""} ${req.student.academicDetails?.graduationYear || ""}`.trim(),
            experience: details.experience,
            projects: details.projects,
            savedProjects: profileProjects.map((project) => ({
              name: project.title,
              description: project.description,
              technologies: project.techStack || [],
              githubUrl: project.githubUrl || "",
              liveDemoUrl: project.liveDemoUrl || "",
            })),
            certifications: details.certifications,
            profileSummary: req.student.bio || "",
            links: req.student.socialProfiles || {},
          }),
        },
      ],
    });

    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("The AI did not return a resume. Please try again.");
    const asStringArray = (value) => Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
    const safeHttpUrl = (value) => {
      try {
        const url = new URL(String(value || "").trim());
        return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
      } catch { return ""; }
    };
    const asEntries = (value, keys) => Array.isArray(value) ? value.filter((item) => item && typeof item === "object").map((item) => Object.fromEntries(keys.map((key) => [key, key === "bullets" ? asStringArray(item[key]) : String(item[key] || "").trim()]))) : [];
    const resumeProjects = asEntries(result.projects, ["name", "technologies", "bullets", "githubUrl", "liveDemoUrl"]);
    resumeProjects.forEach((project) => { project.githubUrl = ""; project.liveDemoUrl = ""; });
    for (const project of profileProjects) {
      const name = String(project.title || "").trim();
      const match = resumeProjects.find((item) => item.name.toLowerCase() === name.toLowerCase());
      if (match) {
        match.githubUrl = safeHttpUrl(project.githubUrl);
        match.liveDemoUrl = safeHttpUrl(project.liveDemoUrl);
        if (!match.technologies) match.technologies = (project.techStack || []).join(", ");
        if (!match.bullets.length && project.description) match.bullets = [project.description];
      } else {
        resumeProjects.push({
          name,
          technologies: (project.techStack || []).join(", "),
          bullets: project.description ? [project.description] : [],
          githubUrl: safeHttpUrl(project.githubUrl),
          liveDemoUrl: safeHttpUrl(project.liveDemoUrl),
        });
      }
    }
    const resume = {
      name: req.user.name,
      email: req.user.email,
      headline: String(result.headline || targetRole).trim(),
      summary: String(result.summary || "").trim(),
      skills: asStringArray(result.skills).length ? asStringArray(result.skills) : skills.split(",").map((skill) => skill.trim()).filter(Boolean),
      experience: asEntries(result.experience, ["role", "company", "duration", "bullets"]),
      projects: resumeProjects,
      education: asEntries(result.education, ["school", "degree", "year", "details"]),
      certifications: asStringArray(result.certifications),
      links: req.student.socialProfiles || {},
    };
    res.json({ success: true, resume });
  } catch (err) {
    console.error("AI Resume Builder Error:", err.message);
    res.status(err.status || 502).json({ error: err.message || "Could not generate your resume." });
  }
};
