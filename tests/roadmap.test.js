const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Roadmap = require("../models/Roadmap");
const DailyTask = require("../models/DailyTask");
const Student = require("../models/Student");
const User = require("../models/User");

let mongoServer;
let studentDoc;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const user = await User.create({ name: "Roadmap Learner", email: "learner@test.com", role: "student" });
  studentDoc = await Student.create({ user: user._id, targetRole: "Full Stack Engineer", skills: ["JavaScript"] });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Roadmap.deleteMany({});
  await DailyTask.deleteMany({});
});

describe("Roadmap Management Suite", () => {
  it("should persist a multi-week roadmap and sync daily tasks", async () => {
    const roadmap = await Roadmap.create({
      student: studentDoc._id,
      title: "Full Stack Accelerated",
      targetRole: "Full Stack Engineer",
      durationWeeks: 4,
      weeks: [
        {
          weekNumber: 1,
          theme: "Foundations & Asynchronous Patterns",
          milestones: [{ title: "Build Event Emitter", isCompleted: false }],
          dailyTasks: ["Study Event Loop", "Implement Promises from scratch"],
        },
      ],
      status: "in-progress",
    });

    expect(roadmap._id).toBeDefined();
    expect(roadmap.weeks.length).toBe(1);

    const taskDocs = roadmap.weeks[0].dailyTasks.map((t) => ({
      student: studentDoc._id,
      roadmap: roadmap._id,
      title: t,
      dueDate: new Date(),
    }));
    await DailyTask.insertMany(taskDocs);

    const savedTasks = await DailyTask.find({ roadmap: roadmap._id });
    expect(savedTasks.length).toBe(2);
  });

  it("should calculate milestone completion progress correctly", async () => {
    const roadmap = await Roadmap.create({
      student: studentDoc._id,
      title: "DevOps Path",
      targetRole: "DevOps Engineer",
      weeks: [
        {
          weekNumber: 1,
          theme: "Containers",
          milestones: [
            { title: "Dockerize Node app", isCompleted: true },
            { title: "Docker Compose cluster", isCompleted: false },
          ],
        },
      ],
    });

    const totalMilestones = roadmap.weeks.reduce((acc, w) => acc + w.milestones.length, 0);
    const completedMilestones = roadmap.weeks.reduce(
      (acc, w) => acc + w.milestones.filter((m) => m.isCompleted).length,
      0
    );

    const percentage = Math.round((completedMilestones / totalMilestones) * 100);
    roadmap.completionPercentage = percentage;
    await roadmap.save();

    expect(roadmap.completionPercentage).toBe(50);
  });
});