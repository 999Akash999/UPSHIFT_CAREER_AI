const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Notification = require("../models/Notification");
const User = require("../models/User");

let mongoServer;
let targetUser;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  targetUser = await User.create({ name: "Notify Target", email: "notify@test.com", role: "student" });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Notification.deleteMany({});
});

describe("Notification Delivery Suite", () => {
  it("should create unread notifications by default", async () => {
    const alert = await Notification.create({
      recipient: targetUser._id,
      title: "🔥 Streak At Risk",
      message: "Complete your task before midnight!",
      category: "streak",
      actionUrl: "/student/daily-tasks",
    });

    expect(alert.isRead).toBe(false);
    expect(alert.category).toBe("streak");
  });

  it("should mark notifications as read", async () => {
    const alert = await Notification.create({
      recipient: targetUser._id,
      title: "Interview Scheduled",
      message: "Recruiter reviewed your application.",
      category: "application",
    });

    alert.isRead = true;
    await alert.save();

    const updated = await Notification.findById(alert._id);
    expect(updated.isRead).toBe(true);
  });
});