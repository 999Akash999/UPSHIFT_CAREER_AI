const SkillAssessment = require("../models/SkillAssessment");
const Project = require("../models/Project");
const Roadmap = require("../models/Roadmap");
const DailyTask = require("../models/DailyTask");
const LearningActivity = require("../models/LearningActivity");
const EmployabilitySnapshot = require("../models/EmployabilitySnapshot");
const Student = require("../models/Student");

const clamp = (value) => Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 10) / 10));

// studentId is always the Student profile ID; assessment/project records use User IDs.
const calculateEmployability = async (studentId) => {
  const student = await Student.findById(studentId).select("user");
  if (!student) throw new Error("Student profile not found");

  const [assessments, projects, roadmap, completedActivities, completedTasks] = await Promise.all([
    SkillAssessment.find({ student: student.user }).sort({ createdAt: -1 }).limit(5).select("score"),
    Project.find({ student: student.user }).select("isVerified"),
    Roadmap.findOne({ student: student._id, status: { $in: ["in-progress", "completed"] } }).sort({ updatedAt: -1 }),
    LearningActivity.countDocuments({ student: student._id, isCompleted: true }),
    DailyTask.countDocuments({ student: student._id, isCompleted: true }),
  ]);

  // Recent assessments count more, but a single test should not decide technical readiness.
  const assessmentWeights = assessments.map((_, index) => 1 / (index + 1));
  const assessmentWeightTotal = assessmentWeights.reduce((sum, weight) => sum + weight, 0);
  const assessmentAverage = assessmentWeightTotal
    ? assessments.reduce((sum, assessment, index) => sum + assessment.score * assessmentWeights[index], 0) / assessmentWeightTotal
    : 0;
  const assessmentConfidence = Math.min(1, assessments.length / 5);
  const technical = assessmentAverage * assessmentConfidence;

  // Multiple projects and verified work build evidence gradually instead of causing large jumps.
  const projectsScore = Math.min(100, projects.length * 8 + projects.filter((project) => project.isVerified).length * 5);
  const roadmapDays = (roadmap?.weeks || []).flatMap((week) =>
    (week.dailyTasks || []).flatMap((task, index) => /^Rest day/i.test(task) ? [] : [Boolean(week.dailyTaskCompletions?.[index])])
  );
  const roadmapProgress = roadmapDays.length
    ? (roadmapDays.filter(Boolean).length / roadmapDays.length) * 100
    : 0;
  const learning = Math.min(100, completedActivities * 4);
  const consistency = Math.min(100, completedTasks * 3);

  const breakdown = {
    technical: clamp(technical),
    projects: clamp(projectsScore),
    roadmapProgress: clamp(roadmapProgress),
    softSkills: clamp(consistency),
    problemSolving: clamp(learning),
  };
  const overallScore = clamp(
    technical * 0.30 + projectsScore * 0.20 + roadmapProgress * 0.20 + learning * 0.20 + consistency * 0.10
  );

  let snapshot = await EmployabilitySnapshot.findOne({ student: student._id }).sort({ createdAt: -1 });
  if (!snapshot) snapshot = new EmployabilitySnapshot({ student: student._id });
  snapshot.overallScore = overallScore;
  snapshot.breakdown = breakdown;
  await snapshot.save();
  return snapshot;
};

const recalculateAfterActivity = async (studentId) => {
  try {
    return await calculateEmployability(studentId);
  } catch (error) {
    // A saved learning action should still succeed if this secondary summary write fails.
    console.error("Employability refresh failed:", error.message);
    return null;
  }
};

module.exports = { calculateEmployability, recalculateAfterActivity };
