const Student = require("../models/Student");
const DailyTask = require("../models/DailyTask");
const Job = require("../models/Job");
const Course = require("../models/Course");
const JobApplication = require("../models/JobApplication");
const Project = require("../models/Project");
const User = require("../models/User");
const { calculateEmployability } = require("../services/employabilityService");
const { getDayBoundsIST, getDateKeyIST } = require("../utils/timeHelpers");

exports.getDashboard = async (req, res) => {
  try {
    // requireStudent has already loaded and verified this profile. Reuse it so
    // a second profile query cannot make the dashboard fail unnecessarily.
    const student = req.student || await Student.findOne({ user: req.user._id });
    
    if (!student) {
      req.flash("error", "Student profile not found. Please complete onboarding.");
      return res.redirect("/onboarding/welcome");
    }

    // 1. Fetch Today's Tasks
    const { start: startOfDay, end: nextDay } = getDayBoundsIST();
    const endOfDay = new Date(nextDay.getTime() - 1);

    const todayTasks = await DailyTask.find({
      student: student._id,
      dueDate: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ isCompleted: 1, dueDate: 1 }).catch((error) => {
      console.error("Dashboard daily tasks unavailable:", error.message);
      return [];
    });

    const completedTasksCount = todayTasks.filter((t) => t.isCompleted).length;

    // Fetch the score without letting this optional summary hide the dashboard.
    const latestScore = await calculateEmployability(student._id).catch((error) => {
      console.error("Dashboard employability summary unavailable:", error.message);
      return { overallScore: 0, breakdown: { technical: 0, projects: 0, roadmapProgress: 0, softSkills: 0, problemSolving: 0 } };
    });

    // Fetch targeted job recommendations based on current skills.
    const matchingJobs = await Job.find({
      requiredSkills: { $in: student.skills },
      status: "active",
    })
      .limit(3)
      .populate("company")
      .catch((error) => { console.error("Dashboard job recommendations unavailable:", error.message); return []; });

    // Fetch targeted upskill courses matching identified skill gaps.
    const gapCourses = await Course.find({
      targetSkillGaps: { $in: student.identifiedGaps || [] },
      isPublished: true,
    }).limit(2).catch((error) => { console.error("Dashboard course recommendations unavailable:", error.message); return []; });
    const activeApplicationsCount = await JobApplication.countDocuments({
      student: req.user._id,
      status: { $in: ["applied", "shortlisted", "interviewing"] },
    }).catch((error) => { console.error("Dashboard application count unavailable:", error.message); return 0; });

    const todayKey = getDateKeyIST(startOfDay);
    const heatmapStart = new Date(startOfDay.getTime() - 364 * 24 * 60 * 60 * 1000);
    const localDay = new Date(`${getDateKeyIST(heatmapStart)}T00:00:00Z`);
    heatmapStart.setTime(heatmapStart.getTime() - ((localDay.getUTCDay() + 6) % 7) * 24 * 60 * 60 * 1000);
    let recentCompletions = [];
    let recentProjects = [];
    try {
      [recentCompletions, recentProjects] = await Promise.all([
      DailyTask.find({ student: student._id, completedAt: { $gte: heatmapStart, $lte: new Date() } }).select("completedAt"),
      Project.find({ student: req.user._id }).sort({ createdAt: -1 }).limit(4),
      ]);
    } catch (activityError) {
      // Keep the dashboard usable even if its optional heatmap/portfolio query fails.
      console.error("Dashboard activity or project data unavailable:", activityError.message);
    }

    const activityCounts = new Map();
    const localDateKey = getDateKeyIST;
    for (const item of recentCompletions) {
      const key = localDateKey(new Date(item.completedAt));
      activityCounts.set(key, (activityCounts.get(key) || 0) + 1);
    }

    const activityWeeks = [];
    const heatmapCursor = new Date(heatmapStart);
    while (heatmapCursor <= endOfDay) {
      const days = [];
      for (let day = 0; day < 7; day += 1) {
        const date = new Date(heatmapCursor);
        const key = localDateKey(date);
        const dateInIST = new Date(`${key}T00:00:00+05:30`);
        const count = activityCounts.get(key) || 0;
        days.push({
          key,
          count,
          level: count === 0 ? 0 : Math.min(4, count),
          label: dateInIST.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric" }),
          future: date > endOfDay,
          today: key === todayKey,
        });
        heatmapCursor.setTime(heatmapCursor.getTime() + 24 * 60 * 60 * 1000);
      }
      const firstDate = new Date(`${days[0].key}T00:00:00`);
      const monthStart = days.map((day) => new Date(`${day.key}T00:00:00`)).find((date) => date.getDate() === 1);
      activityWeeks.push({ days, month: monthStart?.toLocaleDateString("en", { month: "short" }) || (!activityWeeks.length ? firstDate.toLocaleDateString("en", { month: "short" }) : "") });
    }
    const activityTotal = [...activityCounts.values()].reduce((sum, count) => sum + count, 0);
    const todayTaskProgress = todayTasks.length ? Math.round((completedTasksCount / todayTasks.length) * 100) : 0;
    const yesterdayKey = getDateKeyIST(new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000));
    const lastActivityKey = student.lastActivityDate ? getDateKeyIST(student.lastActivityDate) : null;
    const currentStreak = [todayKey, yesterdayKey].includes(lastActivityKey) ? (student.streak || 0) : 0;
    const activeToday = lastActivityKey === todayKey;

    res.render("student/dashboard", {
      title: "Student Dashboard | UPSHIFT CAREER",
      student,
      todayTasks,
      completedTasksCount,
      employabilityScore: latestScore.overallScore,
      scoreMetrics: latestScore.breakdown,
      matchingJobs,
      gapCourses,
      activeApplicationsCount,
      activityWeeks,
      activityTotal,
      currentStreak,
      activeToday,
      todayTaskProgress,
      recentProjects,
    });
  } catch (err) {
    console.error("Dashboard Error:", err.stack || err);
    // A dashboard summary query should never hide the student's workspace.
    // requireStudent has already loaded this profile before this controller.
    const fallbackStudent = req.student;
    if (fallbackStudent) {
      const { start, end } = getDayBoundsIST();
      const endOfDay = new Date(end.getTime() - 1);
      const todayKey = getDateKeyIST(start);
      const yesterdayKey = getDateKeyIST(new Date(start.getTime() - 24 * 60 * 60 * 1000));
      const lastActivityKey = fallbackStudent.lastActivityDate ? getDateKeyIST(fallbackStudent.lastActivityDate) : null;
      const heatmapStart = new Date(start.getTime() - 364 * 24 * 60 * 60 * 1000);
      const firstWeekDay = new Date(`${getDateKeyIST(heatmapStart)}T00:00:00Z`).getUTCDay();
      heatmapStart.setTime(heatmapStart.getTime() - ((firstWeekDay + 6) % 7) * 24 * 60 * 60 * 1000);
      const activityWeeks = [];
      const cursor = new Date(heatmapStart);
      while (cursor <= endOfDay) {
        const days = [];
        for (let index = 0; index < 7; index += 1) {
          const key = getDateKeyIST(cursor);
          const dateInIST = new Date(`${key}T00:00:00+05:30`);
          days.push({
            key, count: 0, level: 0,
            label: dateInIST.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric" }),
            future: cursor > endOfDay, today: key === todayKey,
          });
          cursor.setTime(cursor.getTime() + 24 * 60 * 60 * 1000);
        }
        const firstDate = new Date(`${days[0].key}T00:00:00`);
        const monthStart = days.map((day) => new Date(`${day.key}T00:00:00`)).find((date) => date.getDate() === 1);
        activityWeeks.push({ days, month: monthStart?.toLocaleDateString("en", { month: "short" }) || (!activityWeeks.length ? firstDate.toLocaleDateString("en", { month: "short" }) : "") });
      }
      const currentStreak = [todayKey, yesterdayKey].includes(lastActivityKey) ? (fallbackStudent.streak || 0) : 0;
      res.locals.error = ["Some dashboard data could not load. Your profile is still available; refresh to try again."];
      return res.status(200).render("student/dashboard", {
        title: "Student Dashboard | UPSHIFT CAREER",
        student: fallbackStudent,
        todayTasks: [], completedTasksCount: 0, employabilityScore: 0,
        scoreMetrics: { technical: 0, projects: 0, roadmapProgress: 0, softSkills: 0, problemSolving: 0 },
        matchingJobs: [], gapCourses: [], activeApplicationsCount: 0,
        activityWeeks, activityTotal: 0, currentStreak,
        activeToday: lastActivityKey === todayKey, todayTaskProgress: 0, recentProjects: [],
      });
    }
    return res.status(500).render("errors/500", {
      title: "Dashboard unavailable",
      error: process.env.NODE_ENV === "development" ? err : null,
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    // requireStudent already fetched the authenticated learner. Reuse it rather
    // than doing another profile lookup that could fail and blank the whole page.
    const student = req.student || await Student.findOne({ user: req.user._id });
    if (!student) {
      req.flash("error", "Student profile could not be found. Please complete onboarding again.");
      return res.redirect("/onboarding/welcome");
    }
    const snapshot = await calculateEmployability(student._id).catch((error) => {
      console.error("Profile employability summary unavailable:", error.message);
      return { overallScore: 0, breakdown: { technical: 0, projects: 0, roadmapProgress: 0, softSkills: 0, problemSolving: 0 } };
    });
    return res.render("student/profile", { title: "My Career Profile", student, snapshot });
  } catch (error) {
    console.error("Student profile page failed:", error.stack || error);
    if (req.student) {
      return res.status(200).render("student/profile", {
        title: "My Career Profile", student: req.student,
        snapshot: { overallScore: 0, breakdown: { technical: 0, projects: 0, roadmapProgress: 0, softSkills: 0, problemSolving: 0 } },
      });
    }
    return res.status(500).render("errors/500", { title: "Profile unavailable", message: "Your profile could not be loaded right now." });
  }
};

exports.updateProfile = async (req, res) => {
  const wantsJson = req.xhr || String(req.get("accept") || "").includes("application/json");
  const fail = (message, status = 400) => {
    if (wantsJson) return res.status(status).json({ success: false, error: message });
    req.flash("error", message);
    return res.redirect("/student/profile");
  };
  try {
    const { name, targetRole, primaryDomain, skills, bio, githubUrl, linkedinUrl, leetcodeUrl, portfolioUrl } = req.body;
    const cleanName = String(name || req.user.name || "").trim();
    const cleanRole = String(targetRole || "").trim();
    const cleanBio = String(bio || "").trim();
    if (cleanName.length < 2 || cleanName.length > 100) {
      return fail("Name must be between 2 and 100 characters.");
    }
    if (cleanRole.length < 2 || cleanRole.length > 100) {
      return fail("Target role must be between 2 and 100 characters.");
    }
    if (cleanBio.length > 500) {
      return fail("Bio must be 500 characters or fewer.");
    }

    const cleanUrl = (value, label) => {
      const url = String(value || "").trim();
      if (!url) return "";
      let parsed;
      try { parsed = new URL(url); } catch { const error = new Error(`${label} must be a valid URL starting with https://`); error.status = 400; throw error; }
      if (!['http:', 'https:'].includes(parsed.protocol)) { const error = new Error(`${label} must use http or https.`); error.status = 400; throw error; }
      return parsed.toString();
    };
    const socialProfiles = {
      github: cleanUrl(githubUrl, "GitHub link"),
      linkedin: cleanUrl(linkedinUrl, "LinkedIn link"),
      leetcode: cleanUrl(leetcodeUrl, "LeetCode link"),
      portfolio: cleanUrl(portfolioUrl, "Portfolio link"),
    };
    const parsedSkills = Array.isArray(skills)
      ? skills.map((skill) => String(skill).trim()).filter(Boolean)
      : String(skills || "").split(",").map((skill) => skill.trim()).filter(Boolean);
    if (parsedSkills.some((skill) => skill.length > 50) || parsedSkills.length > 40) {
      return fail("Add up to 40 skills, with each skill under 50 characters.");
    }

    const student = req.student || await Student.findOne({ user: req.user._id });
    if (!student) throw new Error("Student profile not found. Please complete your profile setup again.");
    const cleanDomain = String(primaryDomain || "").trim();
    const preferredLocation = String(req.body.preferredLocation || "").trim();
    const workMode = String(req.body.workMode || "").trim();
    const availability = String(req.body.availability || "").trim();
    const experienceInput = String(req.body.experienceYears ?? "").trim();
    const experienceYears = experienceInput === "" ? 0 : Number(experienceInput);
    const certifications = String(req.body.certifications || "").split("\n").map((item) => item.trim()).filter(Boolean);
    if (cleanDomain.length > 80 || preferredLocation.length > 100) return fail("Domain must be under 80 characters and location under 100 characters.");
    if (!Number.isFinite(experienceYears) || experienceYears < 0 || experienceYears > 50) return fail("Experience must be between 0 and 50 years.");
    if (!["", "Remote", "Hybrid", "On-site"].includes(workMode)) return fail("Choose a valid work preference.");
    if (!["", "Immediately", "Within 1 month", "Within 3 months", "Not looking"].includes(availability)) return fail("Choose a valid availability option.");
    if (certifications.length > 20 || certifications.some((item) => item.length > 120)) return fail("Add up to 20 certifications, each under 120 characters.");
    const college = String(req.body.college || "").trim();
    const degree = String(req.body.degree || "").trim();
    const graduationYearInput = String(req.body.graduationYear || "").trim();
    const cgpaInput = String(req.body.cgpa || "").trim();
    const currentYear = new Date().getFullYear();
    if (college.length > 150 || degree.length > 120) {
      return fail("College name must be under 150 characters and degree under 120 characters.");
    }
    const graduationYear = graduationYearInput ? Number(graduationYearInput) : undefined;
    if (graduationYearInput && (!Number.isInteger(graduationYear) || graduationYear < 1950 || graduationYear > currentYear + 10)) {
      return fail(`Graduation year must be between 1950 and ${currentYear + 10}.`);
    }
    const cgpa = cgpaInput ? Number(cgpaInput) : undefined;
    if (cgpaInput && (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10)) {
      return fail("CGPA must be between 0 and 10.");
    }

    const user = await User.findById(req.user._id);
    if (!user) throw new Error("Your account could not be found while saving the profile.");
    user.name = cleanName;
    if (req.file) user.avatar = `/uploads/avatars/${req.file.filename}`;
    student.targetRole = cleanRole;
    student.primaryDomain = cleanDomain || "Web Development";
    student.careerDetails = { preferredLocation, workMode, experienceYears, availability, certifications };
    student.skills = parsedSkills;
    student.bio = cleanBio;
    student.socialProfiles = socialProfiles;
    student.academicDetails = {
      ...(student.academicDetails?.toObject?.() || student.academicDetails || {}),
      college,
      degree,
      ...(graduationYear !== undefined ? { graduationYear } : { graduationYear: undefined }),
      ...(cgpa !== undefined ? { cgpa } : { cgpa: undefined }),
    };
    await user.save();
    await student.save();

    if (wantsJson) return res.json({ success: true, message: "Profile updated successfully!", profile: { name: user.name, avatar: user.avatar } });
    req.flash("success", "Profile updated successfully!");
    return res.redirect("/student/profile");
  } catch (err) {
    console.error("Student profile update failed:", err);
    const message = err.name === "ValidationError" ? Object.values(err.errors).map((item) => item.message).join(". ") : (err.message || "Failed to update profile.");
    if (wantsJson) return res.status(err.status || (err.name === "ValidationError" ? 400 : 500)).json({ success: false, error: message });
    req.flash("error", message);
    return res.redirect("/student/profile");
  }
};
