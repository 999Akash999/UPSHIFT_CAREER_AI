const Roadmap = require("../models/Roadmap");
const DailyTask = require("../models/DailyTask");
const { buildCurriculum, buildDailyLesson, getRecommendedRoadmapWeeks } = require("../services/roadmapService");
const { recalculateAfterActivity } = require("../services/employabilityService");
const { recordStudentActivity } = require("../services/streakService");
const { getDayBoundsIST } = require("../utils/timeHelpers");
const { getRecommendedDifficulty } = require("../services/adaptiveLearningService");

const calculateRoadmapProgress = (roadmap) => {
  const dailyTasks = (roadmap.weeks || []).flatMap((week) =>
    (week.dailyTasks || []).flatMap((task, index) => /^Rest day/i.test(task) ? [] : [Boolean(week.dailyTaskCompletions?.[index])])
  );
  return dailyTasks.length ? Math.round((dailyTasks.filter(Boolean).length / dailyTasks.length) * 100) : 0;
};

const assessmentDomainForTopic = (title = "") => {
  if (/\b(html|css|frontend|front-end|web ui|accessibility)\b/i.test(title)) return "Web UI";
  if (/javascript|\b(js|promise|async|await|closure|scope|event loop|array|object|function|variable|data type|map, filter|reduce)\b/i.test(title)) return "JavaScript";
  if (/\b(node|express|middleware|route|rest api|http|backend|buffer|stream|file system|async i\/o)\b/i.test(title)) return "Node.js";
  if (/\b(database|mongo|collection|document|schema|crud|populate|relationship|indexing|aggregation|transaction)\b/i.test(title)) return "Databases";
  if (/\b(algorithm|dsa|data structure)\b/i.test(title)) return "Algorithms";
  if (/\b(network|cors|http|https)\b/i.test(title)) return "Networking";
  return null;
};

// Render Student Roadmap View
exports.getRoadmap = async (req, res) => {
  const student = req.student;
  if (!student) return res.status(404).render("errors/404", { title: "Student profile not found" });
  const roadmap = await Roadmap.findOne({ student: student._id, status: { $ne: "archived" } }).sort({ createdAt: -1 });

  res.render("student/roadmap", {
    title: "Learning Roadmap | UPSHIFT CAREER",
    student,
    roadmap,
  });
};

// Trigger AI Roadmap Generation Engine
exports.createRoadmap = async (req, res) => {
  try {
    const student = req.student;
    const { targetRole, experienceLevel, hoursPerDay: requestedHours, daysPerWeek: requestedDays, focusAreas } = req.body || {};

    const goal = String(targetRole || student.targetRole || "Full Stack Developer").trim().slice(0, 100);
    const weeks = getRecommendedRoadmapWeeks(goal);
    const parsedHours = Number.parseFloat(requestedHours);
    const hoursPerDay = Number.isFinite(parsedHours) ? Math.max(0.5, Math.min(12, parsedHours)) : 2;
    const parsedDays = Number.parseInt(requestedDays, 10);
    const daysPerWeek = Number.isFinite(parsedDays) ? Math.max(1, Math.min(7, parsedDays)) : 5;
    const allowedLevels = new Set(["beginner", "intermediate", "advanced"]);
    const level = allowedLevels.has(experienceLevel) ? experienceLevel : "beginner";
    const focus = String(focusAreas || "").trim().slice(0, 500);

    // Generate the roadmap with the configured Gemini model.
    const aiResult = await buildCurriculum({
      targetRole: goal,
      currentSkills: student.skills || [],
      durationWeeks: weeks,
      hoursPerDay,
      daysPerWeek,
      experienceLevel: level,
      focusAreas: focus,
    });

    // Archive previous active roadmaps
    await Roadmap.updateMany({ student: student._id }, { status: "archived" });

    // Store new AI roadmap
    const newRoadmap = await Roadmap.create({
      student: student._id,
      title: `${goal} — ${weeks}-Week Intensive Path`,
      targetRole: goal,
      durationWeeks: weeks,
      hoursPerDay,
      daysPerWeek,
      experienceLevel: level,
      focusAreas: focus ? focus.split(",").map((item) => item.trim()).filter(Boolean) : [],
      identifiedGaps: aiResult.identifiedGaps || [],
      weeks: aiResult.weeks || [],
      status: "in-progress",
    });

    // Populate Week 1 daily tasks automatically
    if (newRoadmap.weeks.length > 0 && newRoadmap.weeks[0].dailyTasks) {
      const { start: todayStart } = getDayBoundsIST();
      const week1Tasks = newRoadmap.weeks[0].dailyTasks.slice(0, daysPerWeek).map((taskTitle, idx) => ({
        student: student._id,
        roadmap: newRoadmap._id,
        title: taskTitle,
        dueDate: new Date(todayStart.getTime() + idx * 24 * 60 * 60 * 1000),
        roadmapWeek: 1,
        roadmapDayIndex: idx,
        lesson: newRoadmap.weeks[0].dailyLearning?.[idx]?.lesson || "",
        keyConcepts: newRoadmap.weeks[0].dailyLearning?.[idx]?.keyConcepts || [],
        example: newRoadmap.weeks[0].dailyLearning?.[idx]?.example || "",
        quiz: newRoadmap.weeks[0].dailyLearning?.[idx]?.quiz || undefined,
        isCompleted: false,
      }));
      await DailyTask.insertMany(week1Tasks);
    }

    // Sync student identified gaps
    student.identifiedGaps = aiResult.identifiedGaps || [];
    await student.save();

    await recalculateAfterActivity(student._id);

    const message = `Your personalized ${weeks}-week roadmap is ready, with a daily plan matched to your available time.`;
    if (req.accepts("json")) return res.json({ success: true, message, durationWeeks: weeks });
    req.flash("success", message);
    return res.redirect("/student/roadmap");
  } catch (err) {
    console.error("Roadmap Generator Error:", err);
    if (req.accepts("json")) return res.status(500).json({ success: false, error: err.message || "Failed to generate your roadmap." });
    req.flash("error", err.message || "Failed to generate AI roadmap.");
    return res.redirect("/student/roadmap");
  }
};

// Check Off Milestone Node
exports.toggleMilestone = async (req, res) => {
  const { roadmapId, weekNumber, milestoneIndex } = req.params;
  
  const roadmap = await Roadmap.findOne({ _id: roadmapId, student: req.student._id });
  if (!roadmap) return res.status(404).json({ success: false, message: "Roadmap not found" });

  const week = roadmap.weeks.find((w) => w.weekNumber === parseInt(weekNumber, 10));
  if (week && week.milestones[milestoneIndex]) {
    // Toggle status flag
    week.milestones[milestoneIndex].isCompleted = !week.milestones[milestoneIndex].isCompleted;
    roadmap.completionPercentage = calculateRoadmapProgress(roadmap);
    roadmap.status = roadmap.completionPercentage === 100 ? "completed" : "in-progress";
    await roadmap.save();
    await recalculateAfterActivity(req.student._id);
    return res.json({ success: true, completed: week.milestones[milestoneIndex].isCompleted, completionPercentage: roadmap.completionPercentage });
  }

  res.status(400).json({ success: false, message: "Invalid milestone reference" });
};

exports.toggleDailyTask = async (req, res) => {
  try {
    const { roadmapId, weekNumber, dayIndex: rawDayIndex } = req.params;
    const dayIndex = Number.parseInt(rawDayIndex, 10);
    // Keep an already-open roadmap usable if the student has since rebuilt it.
    const roadmap = await Roadmap.findOne({ _id: roadmapId, student: req.student._id });
    if (!roadmap) return res.status(404).json({ success: false, message: "Roadmap not found." });

    const week = roadmap.weeks.find((item) => item.weekNumber === Number.parseInt(weekNumber, 10));
    if (!week || !Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= week.dailyTasks.length) {
      return res.status(400).json({ success: false, message: "Invalid daily task." });
    }

    if (!week.dailyTaskCompletions) week.dailyTaskCompletions = [];
    while (week.dailyTaskCompletions.length < week.dailyTasks.length) week.dailyTaskCompletions.push(false);
    week.dailyTaskCompletions[dayIndex] = !week.dailyTaskCompletions[dayIndex];
    const completed = week.dailyTaskCompletions[dayIndex];
    const linkedTask = await DailyTask.findOne({ roadmap: roadmap._id, roadmapWeek: week.weekNumber, roadmapDayIndex: dayIndex, student: req.student._id });
    if (linkedTask) {
      linkedTask.isCompleted = completed;
      if (completed) linkedTask.completedAt = new Date();
      await linkedTask.save();
      if (completed) await recordStudentActivity(req.student._id);
    }
    roadmap.completionPercentage = calculateRoadmapProgress(roadmap);
    await roadmap.save();
    const snapshot = await recalculateAfterActivity(req.student._id);
    return res.json({
      success: true,
      completed,
      completionPercentage: roadmap.completionPercentage,
      employabilityScore: snapshot?.overallScore ?? null,
    });
  } catch (error) {
    console.error("Roadmap daily task update failed:", error);
    return res.status(500).json({ success: false, message: "Could not save this daily task." });
  }
};

exports.getDailyLesson = async (req, res) => {
  try {
    const { roadmapId, weekNumber: rawWeek, dayIndex: rawDay } = req.params;
    const weekNumber = Number.parseInt(rawWeek, 10);
    const dayIndex = Number.parseInt(rawDay, 10);
    // A user may have the roadmap page open while a replacement roadmap is generated.
    // Allow its lesson to finish loading as long as the roadmap still belongs to them.
    const roadmap = await Roadmap.findOne({ _id: roadmapId, student: req.student._id });
    if (!roadmap) return res.status(404).json({ success: false, error: "Roadmap not found." });
    const week = roadmap.weeks.find((item) => item.weekNumber === weekNumber);
    if (!week || !Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= week.dailyTasks.length) {
      return res.status(404).json({ success: false, error: "Learning topic not found." });
    }

    if (!week.dailyLearning) week.dailyLearning = [];
    while (week.dailyLearning.length < week.dailyTasks.length) week.dailyLearning.push({});
    const taskTitle = week.dailyTasks[dayIndex];
    const assessmentDomain = assessmentDomainForTopic(taskTitle);
    const assessedDifficulty = assessmentDomain
      ? await getRecommendedDifficulty(req.user._id, assessmentDomain)
      : null;
    const experienceDifficulty = ({ beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" })[roadmap.experienceLevel] || "Standard";
    const difficulty = assessedDifficulty || experienceDifficulty;
    const difficultySource = assessedDifficulty ? "assessment" : roadmap.experienceLevel ? "roadmap" : "standard";
    let lesson = week.dailyLearning[dayIndex];
    if (!lesson?.summary || !lesson?.lesson || !lesson?.walkthrough?.length || !lesson?.practiceTasks?.length || !lesson?.quiz?.options?.length || lesson.difficulty !== difficulty || lesson.difficultySource !== difficultySource) {
      lesson = await buildDailyLesson({
        targetRole: roadmap.targetRole,
        weekNumber,
        weekTheme: week.theme,
        dayNumber: dayIndex + 1,
        taskTitle,
        difficulty,
        difficultySource,
      });
      week.dailyLearning[dayIndex] = lesson;
      await roadmap.save();
      await DailyTask.updateOne(
        { roadmap: roadmap._id, roadmapWeek: weekNumber, roadmapDayIndex: dayIndex, student: req.student._id },
        { $set: {
          summary: lesson.summary,
          lesson: lesson.lesson,
          prerequisites: lesson.prerequisites,
          keyConcepts: lesson.keyConcepts,
          walkthrough: lesson.walkthrough,
          example: lesson.example,
          commonMistakes: lesson.commonMistakes,
          practiceTasks: lesson.practiceTasks,
          recap: lesson.recap,
          quiz: lesson.quiz,
        } },
      );
    }
    return res.json({ success: true, lesson });
  } catch (error) {
    console.error("Roadmap lesson could not be loaded:", error);
    return res.status(500).json({ success: false, error: "Could not load this lesson. Please try again." });
  }
};
