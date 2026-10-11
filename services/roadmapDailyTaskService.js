const DailyTask = require("../models/DailyTask");
const Roadmap = require("../models/Roadmap");
const { getDayBoundsIST } = require("../utils/timeHelpers");

const DAY_MS = 24 * 60 * 60 * 1000;

/** Return only today's item from the student's current roadmap, creating its
 * linked DailyTask record on demand so every roadmap day reaches the task UI. */
const getTodayRoadmapPlan = async (studentId, today = getDayBoundsIST()) => {
  const roadmap = await Roadmap.findOne({ student: studentId, status: "in-progress" }).sort({ createdAt: -1 });
  if (!roadmap) return { roadmap: null, tasks: [], restDay: false, planDay: null };

  const planStart = getDayBoundsIST(roadmap.createdAt).start;
  const elapsedDays = Math.max(0, Math.floor((today.start.getTime() - planStart.getTime()) / DAY_MS));
  const weekOffset = Math.floor(elapsedDays / 7);
  const roadmapDayIndex = elapsedDays % 7;
  const roadmapWeek = roadmap.weeks.find((week) => week.weekNumber === weekOffset + 1);
  const title = roadmapWeek?.dailyTasks?.[roadmapDayIndex] || "";
  const restDay = /^rest day/i.test(title);
  const planDay = roadmapWeek ? {
    weekNumber: roadmapWeek.weekNumber,
    dayNumber: roadmapDayIndex + 1,
    title,
    theme: roadmapWeek.theme,
    restDay,
  } : null;

  if (!roadmapWeek || !title || restDay) return { roadmap, tasks: [], restDay, planDay };

  const learning = roadmapWeek.dailyLearning?.[roadmapDayIndex] || {};
  let task = await DailyTask.findOne({
    student: studentId,
    roadmap: roadmap._id,
    roadmapWeek: roadmapWeek.weekNumber,
    roadmapDayIndex,
  });
  if (!task) {
    task = await DailyTask.create({
      student: studentId,
      roadmap: roadmap._id,
      roadmapWeek: roadmapWeek.weekNumber,
      roadmapDayIndex,
      title,
      dueDate: today.start,
      summary: learning.summary || "",
      lesson: learning.lesson || "",
      prerequisites: learning.prerequisites || [],
      keyConcepts: learning.keyConcepts || [],
      walkthrough: learning.walkthrough || [],
      example: learning.example || "",
      commonMistakes: learning.commonMistakes || [],
      practiceTasks: learning.practiceTasks || [],
      recap: learning.recap || [],
      quiz: learning.quiz?.options?.length ? learning.quiz : undefined,
      isCompleted: Boolean(roadmapWeek.dailyTaskCompletions?.[roadmapDayIndex]),
    });
  } else if (task.dueDate?.getTime() !== today.start.getTime()) {
    task.dueDate = today.start;
    await task.save();
  }

  return { roadmap, tasks: [task], restDay: false, planDay };
};

module.exports = { getTodayRoadmapPlan };
