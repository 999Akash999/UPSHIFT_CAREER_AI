const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const express = require("express");
const session = require("express-session");
const passport = require("passport");

const User = require("../models/User");
const Student = require("../models/Student");
const authRoutes = require("../routes/authRoutes");
require("../config/passport");

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    session({
      secret: "test_secret",
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());
  // Mock flash
  app.use((req, res, next) => {
    req.flash = () => [];
    next();
  });
  app.use("/", authRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await Student.deleteMany({});
});

describe("Authentication Test Suite", () => {
  it("should register a new student user and create a Student profile", async () => {
    const res = await request(app)
      .post("/signup")
      .send({
        name: "Test Student",
        email: "student@test.com",
        password: "Password123!",
        role: "student",
      });

    expect(res.status).toBe(302); // Redirect to onboarding
    const user = await User.findOne({ email: "student@test.com" });
    expect(user).not.toBeNull();
    expect(user.role).toBe("student");

    const profile = await Student.findOne({ user: user._id });
    expect(profile).not.toBeNull();
  });

  it("should reject duplicate email registrations", async () => {
    await User.register(
      new User({ name: "Existing", email: "existing@test.com", role: "student" }),
      "Password123!"
    );

    const res = await request(app)
      .post("/signup")
      .send({
        name: "Second User",
        email: "existing@test.com",
        password: "Password123!",
        role: "student",
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe("/signup");
    const count = await User.countDocuments({ email: "existing@test.com" });
    expect(count).toBe(1);
  });

  it("should authenticate an existing user with valid credentials", async () => {
    await User.register(
      new User({ name: "Login User", email: "login@test.com", role: "student", isOnboarded: true }),
      "ValidPass123"
    );

    const res = await request(app)
      .post("/login")
      .send({
        username: "login@test.com",
        password: "ValidPass123",
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe("/student/dashboard");
  });

  it("should deny authentication when given an incorrect password", async () => {
    await User.register(
      new User({ name: "Login User", email: "login@test.com", role: "student" }),
      "ValidPass123"
    );

    const res = await request(app)
      .post("/login")
      .send({
        username: "login@test.com",
        password: "WrongPassword!",
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe("/login");
  });
});