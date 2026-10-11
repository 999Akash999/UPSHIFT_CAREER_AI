const Roadmap = require("../models/Roadmap");
const DailyTask = require("../models/DailyTask");
const { buildCurriculum } = require("../services/roadmapService");
const { recalculateAfterActivity } = require("../services/employabilityService");
const { getDayBoundsIST } = require("../utils/timeHelpers");

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
    const { targetRole, durationWeeks } = req.body;

    const goal = targetRole || student.targetRole || "Full Stack Developer";
    const weeks = Math.max(1, Math.min(24, parseInt(durationWeeks, 10) || 8));

    // Generate the roadmap with the configured Gemini model.
    const aiResult = await buildCurriculum({
      targetRole: goal,
      currentSkills: student.skills || [],
      durationWeeks: weeks,
    });

    // Archive previous active roadmaps
    await Roadmap.updateMany({ student: student._id }, { status: "archived" });

    // Store new AI roadmap
    const newRoadmap = await Roadmap.create({
      student: student._id,
      title: `${goal} Accelerated Master Path`,
      targetRole: goal,
      durationWeeks: weeks,
      identifiedGaps: aiResult.identifiedGaps || [],
      weeks: aiResult.weeks || [],
      status: "in-progress",
    });

    // Populate Week 1 daily tasks automatically
    if (newRoadmap.weeks.length > 0 && newRoadmap.weeks[0].dailyTasks) {
      const { start: todayStart } = getDayBoundsIST();
      const week1Tasks = newRoadmap.weeks[0].dailyTasks.map((taskTitle, idx) => ({
        student: student._id,
        roadmap: newRoadmap._id,
        title: taskTitle,
      dueDate: new Date(todayStart.getTime() + (idx + 1) * 24 * 60 * 60 * 1000 - 1),
        isCompleted: false,
      }));
      await DailyTask.insertMany(week1Tasks);
    }

    // Sync student identified gaps
    student.identifiedGaps = aiResult.identifiedGaps || [];
    await student.save();

    req.flash("success", "Custom AI learning roadmap built successfully!");
    res.redirect("/student/roadmap");
  } catch (err) {
    console.error("Roadmap Generator Error:", err);
    req.flash("error", err.message || "Failed to generate AI roadmap.");
    res.redirect("/student/roadmap");
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
    const milestones = roadmap.weeks.flatMap((item) => item.milestones);
    const completeCount = milestones.filter((item) => item.isCompleted).length;
    roadmap.completionPercentage = milestones.length ? Math.round((completeCount / milestones.length) * 100) : 0;
    roadmap.status = milestones.length && completeCount === milestones.length ? "completed" : "in-progress";
    await roadmap.save();
    await recalculateAfterActivity(req.student._id);
    return res.json({ success: true, completed: week.milestones[milestoneIndex].isCompleted });
  }

  res.status(400).json({ success: false, message: "Invalid milestone reference" });
};
