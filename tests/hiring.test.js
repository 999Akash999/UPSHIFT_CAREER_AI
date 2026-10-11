const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Job = require("../models/Job");
const JobApplication = require("../models/JobApplication");
const User = require("../models/User");

let mongoServer;
let recruiter;
let candidate;
let job;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  recruiter = await User.create({ name: "HR Manager", email: "recruiter@hiring.com", role: "recruiter" });
  candidate = await User.create({ name: "Junior Dev", email: "candidate@jobs.com", role: "student" });
  job = await Job.create({
    recruiter: recruiter._id,
    title: "Backend Engineer",
    description: "Node.js and MongoDB specialist required.",
    requiredSkills: ["Node.js", "MongoDB", "Redis"],
    minScoreCutoff: 65,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await JobApplication.deleteMany({});
});

describe("Hiring Pipeline & Job Application Suite", () => {
  it("should create an application and enforce initial 'applied' state", async () => {
    const application = await JobApplication.create({
      student: candidate._id,
      job: job._id,
      resumeUrl: "https://storage.upshift.com/resumes/candidate.pdf",
      employabilityScoreAtApplication: 78,
    });

    expect(application.status).toBe("applied");
    expect(application.job.toString()).toBe(job._id.toString());
  });

  it("should prevent duplicate submissions to the same job by one candidate", async () => {
    await JobApplication.create({
      student: candidate._id,
      job: job._id,
      resumeUrl: "https://storage.upshift.com/resumes/candidate.pdf",
    });

    await expect(
      JobApplication.create({
        student: candidate._id,
        job: job._id,
        resumeUrl: "https://storage.upshift.com/resumes/candidate_v2.pdf",
      })
    ).rejects.toThrow();
  });

  it("should transition through state machine correctly", async () => {
    const appDoc = await JobApplication.create({
      student: candidate._id,
      job: job._id,
      resumeUrl: "https://storage.upshift.com/resumes/candidate.pdf",
    });

    appDoc.status = "shortlisted";
    await appDoc.save();
    expect(appDoc.status).toBe("shortlisted");

    appDoc.status = "offered";
    await appDoc.save();
    expect(appDoc.status).toBe("offered");
  });
});