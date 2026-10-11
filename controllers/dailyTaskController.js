const DailyTask = require("../models/DailyTask");
const Roadmap = require("../models/Roadmap");
const mongoose = require("mongoose");
const { recalculateAfterActivity } = require("../services/employabilityService");
const { recordStudentActivity } = require("../services/streakService");
const { getDateKeyIST, getDayBoundsIST } = require("../utils/timeHelpers");
const { getTodayRoadmapPlan } = require("../services/roadmapDailyTaskService");

const syncRoadmapCompletion = async (task, isCompleted) => {
  if (!task.roadmap || !Number.isInteger(task.roadmapWeek) || !Number.isInteger(task.roadmapDayIndex)) return;
  const roadmap = await Roadmap.findOne({ _id: task.roadmap, student: task.student, status: { $ne: "archived" } });
  const week = roadmap?.weeks.find((item) => item.weekNumber === task.roadmapWeek);
  if (!week || task.roadmapDayIndex >= week.dailyTasks.length) return;
  if (!week.dailyTaskCompletions) week.dailyTaskCompletions = [];
  while (week.dailyTaskCompletions.length < week.dailyTasks.length) week.dailyTaskCompletions.push(false);
  week.dailyTaskCompletions[task.roadmapDayIndex] = isCompleted;
  const dailyStates = (roadmap.weeks || []).flatMap((item) => (item.dailyTasks || [])
    .flatMap((title, index) => /^rest day/i.test(title) ? [] : [Boolean(item.dailyTaskCompletions?.[index])]));
  roadmap.completionPercentage = dailyStates.length ? Math.round((dailyStates.filter(Boolean).length / dailyStates.length) * 100) : 0;
  await roadmap.save();
};

exports.toggleTask = async (req, res) => {
  try {
    const todayPlan = await getTodayRoadmapPlan(req.student._id);
    const task = todayPlan.tasks.find((item) => String(item._id) === String(req.params.id));
    if (!task) return res.status(404).json({ error: "Task not found." });

    task.isCompleted = !task.isCompleted;
    if (task.isCompleted) task.completedAt = new Date();
    // Keep the last completion timestamp as a small activity-history record
    // when a task is unchecked later. It is used by the dashboard heatmap.
    await task.save();
    await syncRoadmapCompletion(task, task.isCompleted);

    const today = getDayBoundsIST();
    let student = req.student;

    // One completed task earns today's activity. Further tasks that day do
    // not inflate the streak, and unchecking a task does not erase a day earned.
    if (task.isCompleted && student) {
      student = await recordStudentActivity(req.student._id) || student;
    }

    const activityStart = new Date(today.start);
    activityStart.setDate(activityStart.getDate() - 364);
    const [snapshot, activityCountToday, activityCompletionsYear] = await Promise.all([
      recalculateAfterActivity(req.student._id),
      DailyTask.countDocuments({ student: req.student._id, completedAt: { $gte: today.start, $lt: today.end } }),
      DailyTask.countDocuments({ student: req.student._id, completedAt: { $gte: activityStart, $lt: today.end } }),
    ]);

    res.json({
      success: true,
      isCompleted: task.isCompleted,
      streak: student.streak || 0,
      employabilityScore: snapshot?.overallScore ?? null,
      completedTasks: task.isCompleted ? 1 : 0,
      totalTasks: todayPlan.tasks.length,
      progress: todayPlan.tasks.length && task.isCompleted ? 100 : 0,
      activityDate: getDateKeyIST(today.start),
      activityCountToday: Math.max(activityCountToday, student.lastActivityDate && getDateKeyIST(student.lastActivityDate) === getDateKeyIST(today.start) ? 1 : 0),
      activeToday: Boolean(student.lastActivityDate && getDateKeyIST(student.lastActivityDate) === getDateKeyIST(today.start)),
      activityCompletionsYear,
    });
  } catch (err) {
    console.error("Daily task update failed:", err.message);
    res.status(500).json({ error: "Could not update this task. Please try again." });
  }
};

exports.saveTasks = async (req, res) => {
  try {
    const { start, end } = getDayBoundsIST();
    const completedTaskIds = req.body?.completedTaskIds;
    if (!Array.isArray(completedTaskIds) || completedTaskIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ error: "Submit a valid list of today’s tasks." });
    }

    const todayPlan = await getTodayRoadmapPlan(req.student._id, { start, end });
    const todayTasks = todayPlan.tasks;
    const ownedIds = new Set(todayTasks.map((task) => String(task._id)));
    const selectedIds = new Set(completedTaskIds.map(String));
    if ([...selectedIds].some((id) => !ownedIds.has(id))) {
      return res.status(400).json({ error: "One or more selected tasks are not in today’s task list." });
    }

    let changed = false;
    const now = new Date();
    for (const task of todayTasks) {
      const shouldBeComplete = selectedIds.has(String(task._id));
      if (task.isCompleted === shouldBeComplete) continue;
      task.isCompleted = shouldBeComplete;
      if (shouldBeComplete) task.completedAt = now;
      // Keep completedAt when a task is unchecked so an earned activity day remains in the heatmap.
      await task.save();
      await syncRoadmapCompletion(task, shouldBeComplete);
      changed = true;
    }

    let student = req.student;
    if (selectedIds.size > 0) student = await recordStudentActivity(req.student._id, now) || student;
    const activityStart = new Date(start.getTime() - 364 * 24 * 60 * 60 * 1000);
    const [snapshot, activityCountToday, activityCompletionsYear] = await Promise.all([
      changed ? recalculateAfterActivity(req.student._id) : Promise.resolve(null),
      DailyTask.countDocuments({ student: req.student._id, completedAt: { $gte: start, $lt: end } }),
      DailyTask.countDocuments({ student: req.student._id, completedAt: { $gte: activityStart, $lt: end } }),
    ]);
    const dateKey = getDateKeyIST(start);
    const activeToday = Boolean(student.lastActivityDate && getDateKeyIST(student.lastActivityDate) === dateKey);
    const completedTasks = todayTasks.filter((task) => task.isCompleted).length;

    return res.json({
      success: true,
      message: "Today’s task progress saved.",
      completedTasks,
      totalTasks: todayTasks.length,
      progress: todayTasks.length ? Math.round((completedTasks / todayTasks.length) * 100) : 0,
      streak: student.streak || 0,
      activeToday,
      activityDate: dateKey,
      activityCountToday: Math.max(activityCountToday, activeToday ? 1 : 0),
      activityCompletionsYear,
      employabilityScore: snapshot?.overallScore ?? null,
    });
  } catch (error) {
    console.error("Daily task progress save failed:", error);
    return res.status(500).json({ error: "Could not save today’s task progress. Please try again." });
  }
};
