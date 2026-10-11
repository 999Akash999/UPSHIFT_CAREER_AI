process.env.INTERVIEW_TAB_SWITCH_COOLDOWN_MS = "0";
process.env.INTERVIEW_BACKGROUND_NOISE_COOLDOWN_MS = "0";
process.env.INTERVIEW_EVENT_RATE_LIMIT = "30";

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const express = require("express");
const InterviewSession = require("../models/InterviewSession");
const User = require("../models/User");
const Student = require("../models/Student");
const interviewRoutes = require("../routes/interviewRoutes");
const adminRoutes = require("../routes/adminRoutes");

let mongoServer;
let app;
let candidate;
let otherCandidate;
let admin;
jest.setTimeout(30000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ instance: { ip: "127.0.0.1" } });
  await mongoose.connect(mongoServer.getUri());
  app = express();
  app.use(express.json());
  app.use(async (req, res, next) => {
    req.user = await User.findById(req.get("x-test-user"));
    req.isAuthenticated = () => Boolean(req.user);
    req.flash = () => [];
    next();
  });
  app.use("/student/interview", interviewRoutes);
  app.use("/admin", adminRoutes);
  candidate = await User.create({ name: "Candidate", email: "candidate@test.com", role: "student", isOnboarded: true });
  otherCandidate = await User.create({ name: "Other", email: "other@test.com", role: "student", isOnboarded: true });
  admin = await User.create({ name: "Admin", email: "admin@test.com", role: "admin" });
  await Student.create({ user: candidate._id, targetRole: "Engineer" });
  await Student.create({ user: otherCandidate._id, targetRole: "Engineer" });
});

afterAll(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

afterEach(async () => {
  if (mongoose.connection.readyState === 1) await InterviewSession.deleteMany({});
});

const createSession = (owner = candidate) => InterviewSession.create({
  student: owner._id,
  roleType: "Engineer",
  status: "active",
  maxWarnings: 3,
  warningCount: 0,
  proctoring: { cameraActive: true, screenActive: true, displaySurface: "monitor" },
});
const sendEvent = (user, id, eventId, type = "TAB_SWITCH", details = { source: "visibilitychange" }) => request(app)
  .post(`/student/interview/${id}/integrity-events`)
  .set("x-test-user", String(user._id))
  .set("Accept", "application/json")
  .send({ eventId, type, details });

describe("Interview integrity policy", () => {
  it("warns on events one and two, then terminates on event three", async () => {
    const session = await createSession();
    const first = await sendEvent(candidate, session._id, "event_00000001");
    const second = await sendEvent(candidate, session._id, "event_00000002");
    const third = await sendEvent(candidate, session._id, "event_00000003");
    expect([first.body.warningCount, second.body.warningCount, third.body.warningCount]).toEqual([1, 2, 3]);
    expect(first.body.action).toBe("warning");
    expect(second.body.message).toMatch(/Final warning/);
    expect(third.body.status).toBe("terminated_integrity");
    expect(third.body.action).toBe("terminated");
    const stored = await InterviewSession.findById(session._id);
    expect(stored.endedAt).toBeInstanceOf(Date);
    expect(stored.integrityEvents.map((event) => event.warningNumber)).toEqual([1, 2, 3]);
  });

  it("deduplicates event IDs and rejects malformed event types", async () => {
    const session = await createSession();
    await sendEvent(candidate, session._id, "event_duplicate1");
    const duplicate = await sendEvent(candidate, session._id, "event_duplicate1");
    const invalid = await sendEvent(candidate, session._id, "event_invalid01", "MADE_UP");
    expect(duplicate.body.warningCount).toBe(1);
    expect(duplicate.body.action).toBe("ignored");
    expect(invalid.status).toBe(400);
    expect((await InterviewSession.findById(session._id)).warningCount).toBe(1);
  });

  it("enforces ownership for event submission and status", async () => {
    const session = await createSession(candidate);
    const event = await sendEvent(otherCandidate, session._id, "event_foreign01");
    const status = await request(app).get(`/student/interview/${session._id}/integrity-status`).set("x-test-user", String(otherCandidate._id)).set("Accept", "application/json");
    expect(event.status).toBe(404);
    expect(status.status).toBe(404);
  });

  it("restricts event history to admins and paginates it", async () => {
    const session = await createSession();
    await sendEvent(candidate, session._id, "event_admin0001");
    const denied = await request(app).get(`/admin/interviews/${session._id}/integrity-events`).set("x-test-user", String(candidate._id)).set("Accept", "application/json");
    const allowed = await request(app).get(`/admin/interviews/${session._id}/integrity-events?limit=1`).set("x-test-user", String(admin._id)).set("Accept", "application/json");
    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(allowed.body.events).toHaveLength(1);
  });

  it("prevents simultaneous events from exceeding the warning limit", async () => {
    const session = await createSession();
    await Promise.all(Array.from({ length: 8 }, (_, index) => sendEvent(candidate, session._id, `event_concurrent${index}`)));
    const stored = await InterviewSession.findById(session._id);
    expect(stored.warningCount).toBe(3);
    expect(stored.status).toBe("terminated_integrity");
  });

  it("rejects further events after termination", async () => {
    const session = await createSession();
    session.status = "terminated_integrity";
    session.terminationReason = "Review";
    session.endedAt = new Date();
    await session.save();
    const response = await sendEvent(candidate, session._id, "event_afterterm01");
    expect(response.status).toBe(409);
    expect(response.body.status).toBe("terminated_integrity");
  });
});
