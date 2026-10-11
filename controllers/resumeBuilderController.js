const AI_CONFIG = require("../config/aiConfig");
const { generateAIContent } = require("../services/aiService");
const Project = require("../models/Project");
const { getTargetRoleSkills } = require("../services/skillGapService");

const splitLines = (value) => String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

function createBasicResume({ user, student, targetRole, skills, details, profileProjects }) {
  const cleanSkills = [...new Set([
    ...String(skills || "").split(/[\n,]/).map((item) => item.trim()),
    ...(student.skills || []).map((item) => String(item).trim()),
  ].filter(Boolean))];
  const savedProjects = profileProjects.map((project) => ({
    name: project.title,
    technologies: (project.techStack || []).join(", "),
    bullets: project.description ? [project.description] : [],
    githubUrl: project.githubUrl || "",
    liveDemoUrl: project.liveDemoUrl || "",
  }));
  const extraProjects = splitLines(details.projects).map((line) => {
    const parts = line.split(/\s+[|—–:]\s+/);
    return { name: parts[0], technologies: "", bullets: parts.slice(1), githubUrl: "", liveDemoUrl: "" };
  });
  const educationParts = details.education.split(",").map((part) => part.trim()).filter(Boolean);

  return {
    name: user.name,
    email: user.email,
    headline: targetRole,
    summary: student.bio || [
      `Target role: ${targetRole}.`,
      cleanSkills.length ? `Skills: ${cleanSkills.join(", ")}.` : "",
    ].filter(Boolean).join(" "),
    skills: cleanSkills,
    experience: splitLines(details.experience).length ? [{
      role: "Experience",
      company: "",
      duration: "",
      bullets: splitLines(details.experience),
    }] : [],
    projects: [...savedProjects, ...extraProjects],
    education: educationParts.length ? [{
      degree: educationParts[0],
      school: educationParts.slice(1).filter((part) => !/^20\d{2}$/.test(part)).join(", "),
      year: educationParts.find((part) => /^\d{4}$/.test(part)) || "",
      details: "",
    }] : (student.academicDetails?.degree || student.academicDetails?.college ? [{
      degree: student.academicDetails?.degree || "",
      school: student.academicDetails?.college || "",
      year: student.academicDetails?.graduationYear || "",
      details: "",
    }] : []),
    certifications: splitLines(details.certifications).flatMap((line) => line.split(",").map((item) => item.trim()).filter(Boolean)),
    links: student.socialProfiles || {},
  };
}

const hasKeyword = (text, keyword) => {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text);
};

const analyzeAtsCoverage = (resume, targetRole, jobDescription) => {
  const description = String(jobDescription || "").trim();
  if (!description) return null;
  const expectedSkills = getTargetRoleSkills(targetRole).filter((skill) => hasKeyword(description, skill));
  if (!expectedSkills.length) return { score: null, matchedSkills: [], missingSkills: [], note: "No skills from the role checklist were found in this job description. Add a clearer description or compare it manually." };
  const resumeText = [
    resume.headline, resume.summary, ...(resume.skills || []), ...(resume.certifications || []),
    ...(resume.experience || []).flatMap((item) => [item.role, item.company, ...(item.bullets || [])]),
    ...(resume.projects || []).flatMap((item) => [item.name, item.technologies, ...(item.bullets || [])]),
    ...(resume.education || []).flatMap((item) => [item.degree, item.school, item.details]),
  ].filter(Boolean).join(" ");
  const matchedSkills = expectedSkills.filter((skill) => hasKeyword(resumeText, skill));
  const missingSkills = expectedSkills.filter((skill) => !matchedSkills.includes(skill));
  return {
    score: Math.round((matchedSkills.length / expectedSkills.length) * 100),
    matchedSkills,
    missingSkills,
    note: "Keyword coverage estimate only; real ATS systems differ. The job description is checked locally and is not sent to AI.",
  };
};

exports.renderBuilder = (req, res) => {
  res.render("student/resume-builder", {
    title: "AI Resume Builder",
    student: req.student,
  });
};

exports.generate = async (req, res) => {
  let basicResume;
  try {
    const body = req.body || {};
    const fields = ["experience", "projects", "education", "certifications"];
    const details = Object.fromEntries(fields.map((field) => [field, String(body[field] || "").trim()]));
    const jobDescription = String(body.jobDescription || "").trim();
    if (!String(body.targetRole || "").trim()) {
      return res.status(400).json({ error: "Add the role you are applying for." });
    }
    if ([...Object.values(details), body.targetRole, body.skills].some((value) => String(value || "").length > 5000) || jobDescription.length > 10000) {
      return res.status(413).json({ error: "Resume fields must be under 5,000 characters and the job description under 10,000 characters." });
    }

    const targetRole = String(body.targetRole).trim().slice(0, 120);
    const skills = String(body.skills || "").trim();
    const profileProjects = await Project.find({ student: req.user._id })
      .sort({ createdAt: -1 })
      .limit(6)
      .select("title description techStack githubUrl liveDemoUrl")
      .lean()
      .catch((error) => {
        console.error("Could not load portfolio projects for resume:", error.message);
        return [];
      });
    basicResume = createBasicResume({ user: req.user, student: req.student, targetRole, skills, details, profileProjects });

    if (!AI_CONFIG.isConfigured) {
      return res.json({
        success: true,
        fallback: true,
        message: "AI is not configured right now, so we created a basic draft using only your saved details.",
        resume: basicResume,
        atsAnalysis: analyzeAtsCoverage(basicResume, targetRole, jobDescription),
      });
    }

    const result = await generateAIContent({
      jsonMode: true,
      maxTokens: 3500,
      timeoutMs: 30000,
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
    res.json({ success: true, fallback: false, resume, atsAnalysis: analyzeAtsCoverage(resume, targetRole, jobDescription) });
  } catch (err) {
    console.error("AI Resume Builder Error:", err.message);
    if (basicResume) {
      return res.json({
        success: true,
        fallback: true,
        message: "AI could not be reached, so we created a basic draft using only your saved details. You can still edit and print it.",
        resume: basicResume,
        atsAnalysis: analyzeAtsCoverage(basicResume, String(req.body?.targetRole || ""), String(req.body?.jobDescription || "")),
      });
    }
    res.status(err.status || 502).json({ error: err.message || "Could not generate your resume." });
  }
};
