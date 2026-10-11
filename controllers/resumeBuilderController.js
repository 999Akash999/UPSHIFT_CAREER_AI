const AI_CONFIG = require("../config/aiConfig");
const { generateAIContent } = require("../services/aiService");
const Project = require("../models/Project");
const { getTargetRoleSkills } = require("../services/skillGapService");
const PDFDocument = require("pdfkit");

const splitLines = (value) => String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const groupSkillItems = (skills) => {
  const categories = [
    ["Languages", ["java", "javascript", "typescript", "python", "c", "c++", "c#", "ruby", "go", "sql"]],
    ["Frontend", ["html", "css", "react", "angular", "vue", "bootstrap", "tailwind", "next.js"]],
    ["Backend", ["node.js", "express", "django", "flask", "spring", "rest api", "graphql"]],
    ["Databases", ["mongodb", "mysql", "postgresql", "redis", "sqlite", "database"]],
    ["Tools", ["git", "github", "docker", "postman", "vscode", "aws", "azure", "linux"]],
    ["Core CS", ["data structures", "algorithms", "oop", "operating systems", "computer networks", "dbms"]],
  ];
  const groups = new Map();
  const add = (group, values) => {
    const current = groups.get(group) || [];
    for (const value of values.map((item) => item.trim()).filter(Boolean)) {
      if (!current.some((item) => item.toLowerCase() === value.toLowerCase())) current.push(value);
    }
    groups.set(group, current);
  };
  for (const raw of Array.isArray(skills) ? skills : []) {
    const text = String(raw || "").trim();
    if (!text) continue;
    const colon = text.indexOf(":");
    if (colon > 0) { add(text.slice(0, colon).trim(), text.slice(colon + 1).split(/[,;|]/)); continue; }
    for (const skill of text.split(/[,;|]/).map((item) => item.trim()).filter(Boolean)) {
      const key = skill.toLowerCase();
      const match = categories.find(([, terms]) => terms.some((term) => key === term || key.includes(term)));
      add(match?.[0] || "Additional Skills", [skill]);
    }
  }
  return [...groups.entries()];
};

function createBasicResume({ user, student, targetRole, skills, details, profileProjects, links, phone }) {
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
    phone,
    headline: targetRole,
    summary: details.summary || student.bio || [
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
    achievements: splitLines(details.achievements),
    links: links || {},
  };
}

function normalizeSocialLinks(input, fallback = {}) {
  const links = {};
  for (const key of ["linkedin", "github", "leetcode", "portfolio"]) {
    const raw = input && Object.prototype.hasOwnProperty.call(input, key) ? input[key] : fallback[key];
    const value = String(raw || "").trim();
    if (!value) { links[key] = ""; continue; }
    if (value.length > 500) return { error: `${key} URL must be 500 characters or fewer.` };
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error("Invalid URL");
      links[key] = url.toString();
    } catch {
      return { error: `Enter a valid http or https URL for ${key}.` };
    }
  }
  return { links };
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
    resume.headline, resume.summary, ...(resume.skills || []), ...(resume.certifications || []), ...(resume.achievements || []),
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
    const fields = ["summary", "experience", "projects", "education", "certifications", "achievements"];
    const details = Object.fromEntries(fields.map((field) => [field, String(body[field] || "").trim()]));
    const jobDescription = String(body.jobDescription || "").trim();
    const socialLinks = normalizeSocialLinks(body.links, req.student.socialProfiles || {});
    if (socialLinks.error) return res.status(400).json({ error: socialLinks.error });
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
    const phone = String(body.phone || "").trim().slice(0, 40);
    basicResume = createBasicResume({ user: req.user, student: req.student, targetRole, skills, details, profileProjects, links: socialLinks.links, phone });

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
          content: "You are an expert resume writer. Return only valid JSON with keys: headline (string), summary (string), skills (array of strings), experience (array of objects with role, company, duration, bullets array), projects (array of objects with name, technologies, bullets array, githubUrl, liveDemoUrl), education (array of objects with school, degree, year, details), certifications (array of strings), achievements (array of strings). Write concise ATS-friendly English. Use profile and portfolio details supplied below. Never invent employers, dates, metrics, credentials, project outcomes, or achievements. Convert project descriptions into clear factual bullets. Omit empty sections and use empty arrays when no facts were provided. Improve phrasing without changing meaning.",
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
            achievements: details.achievements,
            profileSummary: details.summary || req.student.bio || "",
            links: socialLinks.links,
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
    const normalized = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const uniqueText = (...arrays) => [...new Map(arrays.flat().filter(Boolean).map((value) => [normalized(value), String(value).trim()])).values()];
    const resumeProjects = asEntries(result.projects, ["name", "technologies", "bullets", "githubUrl", "liveDemoUrl"]);
    resumeProjects.forEach((project) => { project.githubUrl = ""; project.liveDemoUrl = ""; });
    for (const project of basicResume.projects) {
      const projectName = normalized(project.name);
      const match = resumeProjects.find((item) => {
        const generatedName = normalized(item.name);
        return generatedName === projectName || (generatedName.length > 5 && projectName.length > 5 && (generatedName.includes(projectName) || projectName.includes(generatedName)));
      });
      if (match) {
        match.technologies = uniqueText(String(match.technologies || "").split(/[,|]/), String(project.technologies || "").split(/[,|]/)).join(", ");
        match.bullets = uniqueText(match.bullets, project.bullets);
        match.githubUrl = safeHttpUrl(project.githubUrl);
        match.liveDemoUrl = safeHttpUrl(project.liveDemoUrl);
      } else {
        resumeProjects.push({ ...project, githubUrl: safeHttpUrl(project.githubUrl), liveDemoUrl: safeHttpUrl(project.liveDemoUrl) });
      }
    }
    const experience = asEntries(result.experience, ["role", "company", "duration", "bullets"]);
    const sourceExperience = basicResume.experience.flatMap((item) => item.bullets || []);
    if (!experience.length) experience.push(...basicResume.experience);
    else if (experience.length && sourceExperience.length) {
      const generatedText = normalized(experience.flatMap((item) => [item.role, item.company, item.duration, ...item.bullets]).join(" "));
      const missingDetails = sourceExperience.filter((line) => !generatedText.includes(normalized(line)));
      if (missingDetails.length) experience[0].bullets = uniqueText(experience[0].bullets, missingDetails);
    }
    const education = asEntries(result.education, ["school", "degree", "year", "details"]);
    for (const source of basicResume.education) {
      const match = education.find((item) => (source.school && normalized(item.school) === normalized(source.school))
        || (source.degree && normalized(item.degree) === normalized(source.degree)));
      if (!match) education.push(source);
      else for (const key of ["school", "degree", "year", "details"]) if (!match[key]) match[key] = source[key];
    }
    const resume = {
      name: req.user.name,
      email: req.user.email,
      phone,
      headline: String(result.headline || targetRole).trim(),
      summary: String(result.summary || basicResume.summary).trim(),
      skills: uniqueText(asStringArray(result.skills), basicResume.skills),
      experience,
      projects: resumeProjects,
      education,
      certifications: uniqueText(asStringArray(result.certifications), basicResume.certifications),
      achievements: uniqueText(asStringArray(result.achievements), basicResume.achievements),
      links: socialLinks.links,
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

const pdfSafeText = (value, max = 2000) => String(value || "").slice(0, max)
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[\x00-\x1F\x7F-\x9F]/g, " ").replace(/[^\x20-\xFF]/g, " ").trim();
const pdfList = (value, max = 30) => Array.isArray(value)
  ? value.slice(0, max).map((item) => pdfSafeText(item, 500)).filter(Boolean)
  : [];
const pdfSafeUrl = (value) => {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : "";
  } catch { return ""; }
};

exports.downloadPdf = (req, res) => {
  try {
    let input = req.body?.resume || {};
    if (typeof input === "string") {
      try { input = JSON.parse(input); } catch { return res.status(400).json({ success: false, error: "The resume data could not be read." }); }
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) return res.status(400).json({ success: false, error: "Invalid resume data." });
    const social = normalizeSocialLinks(input.links, {});
    if (social.error) return res.status(400).json({ success: false, error: social.error });
    const resume = {
      name: pdfSafeText(req.user.name, 120),
      email: pdfSafeText(req.user.email, 180),
      phone: pdfSafeText(input.phone, 40),
      headline: pdfSafeText(input.headline, 160),
      summary: pdfSafeText(input.summary, 3000),
      skills: pdfList(input.skills, 80),
      achievements: pdfList(input.achievements),
      certifications: pdfList(input.certifications),
      experience: Array.isArray(input.experience) ? input.experience.slice(0, 15).map((item) => ({
        role: pdfSafeText(item?.role, 160), company: pdfSafeText(item?.company, 160), duration: pdfSafeText(item?.duration, 100), bullets: pdfList(item?.bullets, 12),
      })) : [],
      projects: Array.isArray(input.projects) ? input.projects.slice(0, 15).map((item) => ({
        name: pdfSafeText(item?.name, 180), technologies: pdfSafeText(item?.technologies, 300), bullets: pdfList(item?.bullets, 12), liveDemoUrl: pdfSafeUrl(item?.liveDemoUrl), githubUrl: pdfSafeUrl(item?.githubUrl),
      })) : [],
      education: Array.isArray(input.education) ? input.education.slice(0, 10).map((item) => ({
        degree: pdfSafeText(item?.degree, 180), school: pdfSafeText(item?.school, 180), year: pdfSafeText(item?.year, 80), details: pdfSafeText(item?.details, 500),
      })) : [],
      links: social.links,
    };
    const doc = new PDFDocument({ size: "A4", margins: { top: 38, right: 48, bottom: 38, left: 48 }, compress: true, bufferPages: true, info: { Title: `${resume.name} Resume`, Author: resume.name } });
    const fileName = `${resume.name.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "Resume"}_Resume.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Cache-Control", "private, no-store");
    doc.on("error", (error) => {
      console.error("Resume PDF generation failed:", error.message);
      if (!res.headersSent) res.status(500).end();
      else res.destroy(error);
    });
    doc.pipe(res);

    const x = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.font("Times-Bold").fontSize(23).fillColor("#111111").text(resume.name.toUpperCase(), x, 36, { width, align: "center", lineBreak: false });
    doc.font("Times-Roman").fontSize(10).fillColor("#222222");
    const contact = [resume.phone, resume.email].filter(Boolean).join("     —     ");
    if (contact) doc.text(contact, x, 64, { width, align: "center" });
    const socialItems = Object.entries({ linkedin: "LinkedIn", github: "GitHub", leetcode: "LeetCode", portfolio: "Portfolio" })
      .filter(([key]) => resume.links[key]).map(([key, label]) => ({ label, url: resume.links[key] }));
    if (socialItems.length) {
      const gap = 18;
      const widths = socialItems.map(({ label }) => doc.widthOfString(label));
      const totalWidth = widths.reduce((sum, item) => sum + item, 0) + gap * (socialItems.length - 1);
      let linkX = x + Math.max(0, (width - totalWidth) / 2);
      socialItems.forEach(({ label, url }, index) => {
        doc.fillColor("#111111").text(label, linkX, contact ? 80 : 64, { width: widths[index], link: url, underline: true, lineBreak: false });
        linkX += widths[index] + gap;
        if (index < socialItems.length - 1) {
          doc.fillColor("#777777").text("—", linkX - gap / 2 - 3, contact ? 80 : 64, { lineBreak: false });
        }
      });
      doc.y = (contact ? 94 : 78);
    } else {
      doc.y = contact ? 88 : 72;
    }
    doc.fillColor("#111111");

    const section = (title) => {
      if (doc.y > doc.page.height - 75) doc.addPage();
      doc.moveDown(0.35);
      const y = doc.y;
      doc.font("Times-Bold").fontSize(12).fillColor("#111111").text(title, x, y, { width, lineBreak: false });
      const lineY = y + 16;
      doc.moveTo(x, lineY).lineTo(x + width, lineY).lineWidth(0.65).strokeColor("#333333").stroke();
      doc.y = lineY + 4;
      doc.font("Times-Roman").fontSize(10.5).fillColor("#111111");
    };
    const paragraph = (value) => {
      if (!value) return;
      doc.font("Times-Roman").fontSize(10.5).text(pdfSafeText(value), x, doc.y, { width, align: "justify", lineGap: 0.4 });
      doc.moveDown(0.2);
    };
    const bullet = (value) => {
      if (!value) return;
      doc.font("Times-Roman").fontSize(10.2).text(`•  ${pdfSafeText(value)}`, x + 2, doc.y, { width: width - 2, indent: 9, hanging: 9, lineGap: 0.3 });
    };
    const entryHeading = (title, date, link) => {
      const y = doc.y;
      const right = link ? "Live Demo" : pdfSafeText(date, 90);
      doc.font("Times-Bold").fontSize(10.5).fillColor("#111111").text(pdfSafeText(title), x, y, { width: width * 0.75, lineBreak: false });
      if (right) doc.font("Times-Roman").fontSize(10).fillColor("#111111").text(right, x + width * 0.72, y, { width: width * 0.28, align: "right", link: link || undefined, underline: Boolean(link), lineBreak: false });
      doc.y = y + Math.max(doc.heightOfString(pdfSafeText(title), { width: width * 0.72, font: "Times-Bold", fontSize: 10.5 }), 13) + 1;
    };

    if (resume.summary) { section("Professional Summary"); paragraph(resume.summary); }
    if (resume.education.length) {
      section("Education");
      resume.education.forEach((item) => {
        entryHeading(item.degree || item.school, item.year);
        if (item.school && item.degree) paragraph(item.school);
        if (item.details) paragraph(item.details);
      });
    }
    const skillGroups = groupSkillItems(resume.skills);
    if (skillGroups.length) {
      section("Technical Skills");
      skillGroups.forEach(([category, values]) => {
        doc.font("Times-Bold").fontSize(10.2).text(`${pdfSafeText(category, 80)}:`, x + 4, doc.y, { continued: true, indent: 12, hanging: 12 });
        doc.font("Times-Roman").text(` ${pdfSafeText(values.join(", "), 700)}`);
      });
    }
    if (resume.experience.length) {
      section("Experience");
      resume.experience.forEach((item) => {
        entryHeading([item.role, item.company].filter(Boolean).join(" — "), item.duration);
        item.bullets.forEach(bullet);
      });
    }
    if (resume.projects.length) {
      section("Projects");
      resume.projects.forEach((item) => {
        entryHeading([item.name, item.technologies].filter(Boolean).join(" — "), "", item.liveDemoUrl);
        item.bullets.forEach(bullet);
        if (item.githubUrl) {
          doc.font("Times-Roman").fontSize(9.5).fillColor("#111111").text("Source code", x + 14, doc.y, { link: item.githubUrl, underline: true });
        }
      });
    }
    if (resume.achievements.length) { section("Achievements"); resume.achievements.forEach(bullet); }
    if (resume.certifications.length) { section("Certifications"); resume.certifications.forEach(bullet); }
    const pages = doc.bufferedPageRange();
    for (let index = pages.start; index < pages.start + pages.count; index += 1) {
      doc.switchToPage(index);
      doc.font("Times-Roman").fontSize(9).fillColor("#333333").text(String(index + 1), x, doc.page.height - doc.page.margins.bottom - 12, { width, align: "center", lineBreak: false });
    }
    doc.end();
  } catch (error) {
    console.error("Resume PDF request failed:", error.message);
    if (!res.headersSent) return res.status(500).json({ success: false, error: "Could not create the resume PDF." });
    return res.end();
  }
};
