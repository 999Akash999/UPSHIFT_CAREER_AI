require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User");
const Student = require("../models/Student");
const RecruiterProfile = require("../models/RecruiterProfile");
const MentorProfile = require("../models/MentorProfile");
const Company = require("../models/Company");
const Job = require("../models/Job");
const Course = require("../models/Course");
const Roadmap = require("../models/Roadmap");
const DailyTask = require("../models/DailyTask");
const EmployabilitySnapshot = require("../models/EmployabilitySnapshot");
const Assessment = require("../models/Assessment");
const Project = require("../models/Project");
const Notification = require("../models/Notification");
const AlumniEvent = require("../models/AlumniEvent");
const EventRegistration = require("../models/EventRegistration");

const databaseUrl = process.env.ATLASDB_URL || process.env.MONGO_URI;
const demoPassword = process.env.DEMO_PASSWORD || "UpshiftDemo2026!";
const extraMentorSeeds = [
  { name: "Ananya Rao", email: "demo.mentor.ananya@example.com", expertise: ["React", "Frontend", "Portfolio reviews"], rate: 399, bio: "Frontend engineer helping learners build polished React projects and prepare for UI interviews." },
  { name: "Dev Shah", email: "demo.mentor.dev@example.com", expertise: ["Data Structures", "Algorithms", "Interview prep"], rate: 299, bio: "Patient coding interview mentor focused on DSA patterns, problem solving, and mock interviews." },
  { name: "Meera Iyer", email: "demo.mentor.meera@example.com", expertise: ["Node.js", "MongoDB", "Backend APIs"], rate: 449, bio: "Backend developer who helps students design APIs, work with databases, and ship full stack projects." },
];

if (!databaseUrl) {
  console.error("Set ATLASDB_URL or MONGO_URI before seeding demo data.");
  process.exit(1);
}

async function ensureUser({ name, email, role }) {
  const normalizedEmail = email.toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    user = new User({
      name,
      email: normalizedEmail,
      role,
      isEmailVerified: true,
      isOnboarded: true,
    });
    await User.register(user, demoPassword);
  } else {
    user.name = name;
    user.role = role;
    user.isEmailVerified = true;
    user.isOnboarded = true;
    await user.save();
  }
  return user;
}

async function run() {
  await mongoose.connect(databaseUrl, { serverSelectionTimeoutMS: 15000 });

  const [studentUser, recruiterUser, mentorUser, eventHost, ...extraMentorUsers] = await Promise.all([
    ensureUser({ name: "Aarav Demo", email: "demo.student@example.com", role: "student" }),
    ensureUser({ name: "Riya Recruiter", email: "demo.recruiter@example.com", role: "recruiter" }),
    ensureUser({ name: "Kabir Mentor", email: "demo.mentor@example.com", role: "mentor" }),
    ensureUser({ name: "UPSHIFT Demo Events", email: "demo.events@example.com", role: "alumni" }),
    ...extraMentorSeeds.map(({ name, email }) => ensureUser({ name, email, role: "mentor" })),
  ]);

  const company = await Company.findOneAndUpdate(
    { name: "Upshift Demo Labs" },
    {
      $set: {
        website: "https://example.com",
        industry: "Software Development",
        description: "Sample company record for exploring the recruiter workflow.",
        location: "Bengaluru, India",
        tier: "Startup",
        isVerified: true,
      },
    },
    { returnDocument: "after", upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  await Promise.all([
    RecruiterProfile.findOneAndUpdate(
      { user: recruiterUser._id },
      { $set: { company: company._id, designation: "Demo Recruiter", hiringDomains: ["Full Stack"] } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ),
    MentorProfile.findOneAndUpdate(
      { user: mentorUser._id },
      {
        $set: {
          expertise: ["JavaScript", "Node.js", "System Design"],
          bio: "Full stack engineer offering affordable guidance on JavaScript, backend systems, and system design interviews.",
          hourlyRate: 499,
          verifiedCredentials: true,
          isDemo: true,
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ),
  ]);

  await Promise.all(extraMentorSeeds.map((mentor, index) => MentorProfile.findOneAndUpdate(
    { user: extraMentorUsers[index]._id },
    { $set: { expertise: mentor.expertise, bio: mentor.bio, hourlyRate: mentor.rate, verifiedCredentials: true, isDemo: true } },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true }
  )));

  const student = await Student.findOneAndUpdate(
    { user: studentUser._id },
    {
      $set: {
        targetRole: "Full Stack Developer",
        primaryDomain: "Web Development",
        skills: ["JavaScript", "HTML", "CSS", "React"],
        identifiedGaps: ["Node.js", "MongoDB", "Testing"],
        academicDetails: {
          college: "Demo Institute of Technology",
          degree: "B.Tech Computer Science",
          graduationYear: 2027,
          cgpa: 8.2,
        },
        bio: "Demo learner profile used to explore the student dashboard.",
      },
    },
    { returnDocument: "after", upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  const dayMs = 24 * 60 * 60 * 1000;
  const eventSeeds = [
    { title: "Demo BuildSprint Hackathon", category: "hackathon", days: 5, description: "A beginner-friendly team hackathon to build and demo a useful web app in one day." },
    { title: "Demo Campus Innovation Ideathon", category: "ideathon", days: 12, description: "Pitch practical ideas for improving student life and get feedback from product mentors." },
    { title: "Demo Full Stack Career Webinar", category: "webinar", days: 19, description: "A live session on building production-ready projects, portfolios, and interview skills." },
    { title: "Demo AI for Good Hackathon", category: "hackathon", days: 27, description: "Prototype an AI-powered solution for a real community challenge with a small team." },
    { title: "Demo GreenTech Ideathon", category: "ideathon", days: 34, description: "Explore sustainability problem statements and turn one into a clear product concept." },
    { title: "Demo DSA Interview Webinar", category: "webinar", days: 41, description: "Practice common coding interview patterns with a mentor-led walkthrough and Q&A." },
    { title: "Demo Web App Hackathon", category: "hackathon", days: -21, description: "Demo attendance record: participants built and presented a small full stack application." },
    { title: "Demo Product Thinking Ideathon", category: "ideathon", days: -35, description: "Demo attendance record: teams presented ideas and received peer feedback." },
    { title: "Demo Resume and Portfolio Webinar", category: "webinar", days: -49, description: "Demo attendance record: a practical session on presenting project work to employers." },
  ];
  const seededEvents = await Promise.all(eventSeeds.map((event) => AlumniEvent.findOneAndUpdate(
    { host: eventHost._id, title: event.title },
    { $set: {
      category: event.category,
      description: event.description,
      scheduledAt: new Date(Date.now() + event.days * dayMs),
      capacity: 100,
      meetLink: "",
    }, $setOnInsert: { registrationCount: 0 } },
    { returnDocument: "after", upsert: true, runValidators: true, setDefaultsOnInsert: true }
  )));
  const demoUpcomingEvent = seededEvents.find((event) => event.title === "Demo BuildSprint Hackathon");
  const demoPastEvents = seededEvents.filter((event) => event.scheduledAt < new Date());
  await Promise.all([
    EventRegistration.findOneAndUpdate(
      { user: studentUser._id, event: demoUpcomingEvent._id },
      { $setOnInsert: { attended: false } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ),
    ...demoPastEvents.map((event) => EventRegistration.findOneAndUpdate(
      { user: studentUser._id, event: event._id },
      { $set: { attended: true } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true }
    )),
  ]);
  await Promise.all(seededEvents.map(async (event) => {
    const registrationCount = await EventRegistration.countDocuments({ event: event._id });
    await AlumniEvent.updateOne({ _id: event._id }, { $set: { registrationCount } });
  }));

  const course = await Course.findOneAndUpdate(
    { slug: "demo-full-stack-foundations" },
    {
      $set: {
        title: "Demo Full Stack Foundations",
        description: "A sample course covering practical JavaScript, APIs, and data storage.",
        instructor: mentorUser._id,
        price: 2499,
        discountPrice: 1499,
        category: "Full Stack",
        targetSkillGaps: ["Node.js", "MongoDB", "Testing"],
        level: "Beginner",
        isPublished: true,
        modules: [
          {
            title: "Build the foundations",
            description: "Practice core full stack development concepts.",
            lessons: [
              { title: "JavaScript for web apps", durationMinutes: 25, isFreePreview: true },
              { title: "Build a JSON API", durationMinutes: 35 },
              { title: "Persist data with MongoDB", durationMinutes: 30 },
            ],
          },
        ],
      },
    },
    { returnDocument: "after", upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  await Student.updateOne({ _id: student._id }, { $addToSet: { enrolledCourses: course._id } });

  const job = await Job.findOneAndUpdate(
    { recruiter: recruiterUser._id, title: "Demo Junior Full Stack Developer" },
    {
      $set: {
        company: company._id,
        description: "Sample role for exploring job matching and applications. No real hiring is attached to this listing.",
        requiredSkills: ["JavaScript", "React", "Node.js"],
        minScoreCutoff: 50,
        salary: "₹6–9 LPA",
        location: "Remote, India",
        type: "Full-Time",
        status: "active",
      },
    },
    { returnDocument: "after", upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  const roadmap = await Roadmap.findOneAndUpdate(
    { student: student._id, title: "Demo Full Stack Career Roadmap" },
    {
      $set: {
        targetRole: "Full Stack Developer",
        durationWeeks: 2,
        identifiedGaps: ["Node.js", "MongoDB", "Testing"],
        status: "in-progress",
        weeks: [
          {
            weekNumber: 1,
            theme: "APIs and persistence",
            milestones: [
              { title: "Create a REST API", isCompleted: true },
              { title: "Connect an API to MongoDB", isCompleted: false },
            ],
            dailyTasks: ["Build one endpoint", "Add input validation"],
          },
          {
            weekNumber: 2,
            theme: "Testing and delivery",
            milestones: [{ title: "Write API tests", isCompleted: false }],
            dailyTasks: ["Test success and error cases", "Document the project"],
          },
        ],
      },
    },
    { returnDocument: "after", upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  await Promise.all([
    DailyTask.findOneAndUpdate(
      { student: student._id, title: "Demo: build a REST API endpoint" },
      { $set: { roadmap: roadmap._id, dueDate: today, isCompleted: true } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ),
    DailyTask.findOneAndUpdate(
      { student: student._id, title: "Demo: add API input validation" },
      { $set: { roadmap: roadmap._id, dueDate: today, isCompleted: false } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ),
    EmployabilitySnapshot.findOneAndUpdate(
      { student: student._id },
      {
        $set: {
          overallScore: 68,
          breakdown: { technical: 72, problemSolving: 64, roadmapProgress: 55, softSkills: 70, projects: 68 },
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true, sort: { createdAt: -1 } }
    ),
  ]);

  await Promise.all([
    Assessment.findOneAndUpdate(
      { title: "Demo JavaScript Fundamentals", domain: "Full Stack" },
      {
        $set: {
          description: "Sample assessment for trying the quiz flow.",
          durationMinutes: 10,
          passingScore: 60,
          isPublished: true,
          questions: [
            {
              prompt: "Which method creates a new array by transforming each item?",
              options: ["map", "filter", "find", "reduce"],
              correctAnswerIndex: 0,
              explanation: "Array.prototype.map returns a transformed array.",
              points: 10,
            },
            {
              prompt: "Which status code usually indicates a successful resource creation?",
              options: ["200", "201", "204", "301"],
              correctAnswerIndex: 1,
              explanation: "201 Created is commonly returned after creating a resource.",
              points: 10,
            },
          ],
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ),
    Project.findOneAndUpdate(
      { student: studentUser._id, title: "Demo Task Tracker API" },
      {
        $set: {
          description: "A sample project record demonstrating API design and persistent storage.",
          techStack: ["Node.js", "Express", "MongoDB"],
          githubUrl: "https://github.com/example/demo-task-tracker",
          liveDemoUrl: "https://example.com/demo-task-tracker",
          isVerified: false,
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ),
    Notification.findOneAndUpdate(
      { recipient: studentUser._id, title: "Welcome to your demo workspace" },
      {
        $set: {
          message: "Your sample profile, roadmap, tasks, course, and job listing are ready to explore.",
          category: "system",
          actionUrl: "/student/dashboard",
          isRead: false,
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ),
  ]);

  console.log("Demo data is ready.");
  console.log("Accounts: demo.student@example.com, demo.recruiter@example.com, demo.mentor@example.com");
  console.log(`Affordable demo mentors: ${extraMentorSeeds.map((mentor) => mentor.email).join(", ")}`);
  console.log("Events include upcoming hackathons, ideathons, webinars, and attended demo history for the demo student.");
  console.log("Password for newly created demo accounts: set DEMO_PASSWORD to customize it.");
  console.log(`Sample job: ${job.title}; sample course: ${course.slug}`);
}

run()
  .catch((error) => {
    console.error("Could not seed demo data:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
