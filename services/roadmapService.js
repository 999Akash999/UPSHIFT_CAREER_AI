const { generateAIContent } = require("./aiService");
const AI_ENGINEERING_TOPICS = require("../data/aiEngineeringTopics.json");
const DATA_SCIENCE_TOPICS = require("../data/dataScienceTopics.json");

const SIX_MONTH_THEMES = [
  "Backend Fundamentals (Topics 1–9)", "JavaScript Deep Dive I (Topics 10–14)",
  "JavaScript Deep Dive II (Topics 15–20)", "Node.js (Topics 21–29)",
  "Express.js (Topics 30–36)", "MongoDB & Mongoose I (Topics 37–42)",
  "MongoDB & Mongoose II (Topics 43–47)", "Authentication & Authorization I (Topics 48–52)",
  "Authentication & Authorization II (Topics 53–56)", "File Uploads (Topics 57–61)",
  "Real Projects I (Topics 62–66)", "Real Projects II (Topics 67–68)",
  "External APIs (Topics 69–74)", "Redis & Queues (Topics 75–80)",
  "Payments (Topics 81–85)", "Real-Time Systems (Topics 86–89)",
  "Security (Topics 90–96)", "Testing (Topics 97–101)",
  "Production Engineering I (Topics 102–109)", "Production Engineering II (Topics 110–119)",
  "Production Engineering III (Topics 120–123)", "System Design I (Topics 124–129)",
  "Backend project integration", "Backend project implementation",
  "Backend project testing and hardening", "Production-ready backend capstone",
];

// Keep these titles aligned with Akash's supplied Backend Learning Index.
const BACKEND_INDEX_TOPICS = [
  "Backend क्या है?", "Frontend vs Backend", "Client-Server Architecture", "HTTP & HTTPS", "Request-Response Cycle", "MVC Architecture", "Routes, Controllers, Models, Services", "Middleware", "Error Handling",
  "Variables (let, const, var)", "Data Types", "Arrays", "Objects", "Functions", "Scope", "Closures", "Async/Await", "Promises", "Event Loop", "Map, Filter, Reduce",
  "What is Node.js?", "Runtime Environment", "npm", "package.json", "Environment Variables", "Streams", "Buffers", "File System", "Async I/O",
  "Express Introduction", "Routes", "Router", "req / res", "next()", "Middleware Flow", "REST APIs",
  "Database", "Collections", "Documents", "Schema", "Models", "CRUD Operations", "Populate", "Relationships", "Indexing", "Aggregation", "Transactions",
  "Authentication", "Authorization", "bcrypt", "JWT", "Cookies", "Access Token", "Refresh Token", "Passport.js", "Role-Based Access Control (RBAC)",
  "Multer", "multipart/form-data", "Cloudinary", "Image Upload Flow", "Image Storage Strategy",
  "MakeYourTrip Architecture", "Flight Booking System", "Hotel Booking System", "Bike Rental System", "Ride Booking / Cab System", "Organization vs Admin vs User", "Search Bar & Suggestions",
  "API Keys", ".env Configuration", "Flight API Integration", "Request Transformation", "Response Mapping", "Error Handling for APIs",
  "Redis Basics", "Caching", "Rate Limiting", "OTP Storage", "BullMQ", "Background Jobs",
  "Payment Gateway Flow", "Orders", "Verification", "Webhooks", "Refunds",
  "Socket.IO", "Driver Tracking", "Live Updates", "Ride Status Changes",
  "Helmet", "CORS", "CSRF", "XSS", "NoSQL Injection", "Secure Cookies", "Secret Management",
  "Postman", "Jest", "Supertest", "Integration Testing", "API Testing",
  "Docker", "Dockerfile", "Docker Compose", "Container Networking", "CI/CD", "GitHub Actions", "Automated Testing", "Automated Deployment", "Logging", "Pino", "Winston", "Structured Logs", "Monitoring", "Health Checks", "Metrics", "Prometheus", "Grafana", "Alerts", "Deployment", "MongoDB Atlas", "Domains", "Production Environment",
  "Load Balancer", "Scaling", "Redis Layer", "Queue Layer", "CDN", "High-Level Architecture",
];

const BACKEND_INDEX_SECTIONS = [
  [1, 9, "Backend Fundamentals"], [10, 20, "JavaScript Deep Dive"], [21, 29, "Node.js"],
  [30, 36, "Express.js"], [37, 47, "MongoDB & Mongoose"], [48, 56, "Authentication & Authorization"],
  [57, 61, "File Uploads"], [62, 68, "Real Projects"], [69, 74, "External APIs"],
  [75, 80, "Redis & Queues"], [81, 85, "Payments"], [86, 89, "Real-Time Systems"],
  [90, 96, "Security"], [97, 101, "Testing"], [102, 123, "Production Engineering"], [124, 129, "System Design"],
];

const BACKEND_FINAL_GOAL = "Final Goal: User → Frontend → Route → Middleware → Authentication → Authorization → Validation → Controller → Service → Database/API → Response → User";

const getRoleTrack = (role = "") => {
  const normalized = String(role).toLowerCase().replace(/[\/_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (/\b(data scientist|data analyst|machine learning analyst)\b/.test(normalized)) return "dataScience";
  if (/\b(ai|artificial intelligence|machine learning|ml engineer|deep learning|generative ai|llm|nlp|computer vision|agent developer|production ai)\b/.test(normalized)) return "aiEngineering";
  if (/\b(back ?end|server ?side)\b/.test(normalized)) return "backend";
  if (/\b(full ?stack|software engineer|web developer)\b/.test(normalized)) return "fullStack";
  return "custom";
};

const isAIEngineeringRole = (role = "") => getRoleTrack(role) === "aiEngineering";
const getRecommendedRoadmapWeeks = (role = "") => isAIEngineeringRole(role) ? 24 : 26;

const sectionForTopic = (topicNumber) => BACKEND_INDEX_SECTIONS.find(([start, end]) => topicNumber >= start && topicNumber <= end)?.[2] || "Backend Learning Index";

const buildIndexWeeks = ({ durationWeeks, hoursPerDay, daysPerWeek }) => {
  const weekCount = Math.max(1, Number(durationWeeks) || 26);
  const studyDays = Math.max(1, Math.min(7, Number(daysPerWeek) || 5));
  const totalSlots = weekCount * studyDays;
  const curriculumItems = [
    ...BACKEND_INDEX_TOPICS.map((title, index) => ({ title, number: index + 1 })),
    { title: BACKEND_FINAL_GOAL, number: null },
  ];
  const topicCount = curriculumItems.length;
  const topicsPerSlot = Array.from({ length: totalSlots }, () => []);
  // At five study days/week, each numbered topic and the final goal get their own day.
  curriculumItems.forEach((topic, topicIndex) => {
    const slot = Math.min(totalSlots - 1, Math.floor(topicIndex * totalSlots / topicCount));
    topicsPerSlot[slot].push(topic);
  });

  return Array.from({ length: weekCount }, (_, weekIndex) => {
    const weekTopics = topicsPerSlot.slice(weekIndex * studyDays, (weekIndex + 1) * studyDays).flat();
    const sectionNames = [...new Set(weekTopics.map(({ number }) => number ? sectionForTopic(number) : "Final Goal"))];
    const dailyTasks = Array.from({ length: 7 }, (_, dayIndex) => {
      if (dayIndex >= studyDays) return "Rest day or optional catch-up";
      const topics = topicsPerSlot[weekIndex * studyDays + dayIndex];
      if (!topics.length) return `Build and review a practical project using ${sectionNames.at(-1) || "the backend syllabus"}`;
      const title = topics.map(({ title, number }) => number ? `Topic ${number}: ${title}` : title).join(" · ");
      return `${title} (${hoursPerDay}h)`;
    });
    return {
      weekNumber: weekIndex + 1,
      theme: sectionNames.length ? sectionNames.join(" + ") : SIX_MONTH_THEMES[weekIndex % SIX_MONTH_THEMES.length],
      milestones: [],
      dailyTasks,
      dailyTaskCompletions: Array(7).fill(false),
    };
  });
};

const buildTopicTrackWeeks = ({ topics, durationWeeks, hoursPerDay, daysPerWeek }) => {
  const weekCount = Math.max(1, Number(durationWeeks) || 24);
  const studyDays = Math.max(1, Math.min(7, Number(daysPerWeek) || 5));
  const totalSlots = weekCount * studyDays;
  const topicsPerSlot = Array.from({ length: totalSlots }, () => []);
  topics.forEach((topic, index) => {
    const slot = Math.min(totalSlots - 1, Math.floor(index * totalSlots / topics.length));
    topicsPerSlot[slot].push(topic);
  });

  const practiceFormats = [
    (section) => `Practice: explain the key ideas from ${section} and answer a short self-check`,
    (section) => `Practice: complete a guided ${section} exercise and verify the result`,
    (section) => `Practice: build a small ${section} example and document your decisions`,
    (section) => `Practice: debug a ${section} scenario and describe the root cause`,
    (section) => `Practice: test edge cases and improve a ${section} deliverable`,
    (section) => `Practice: review your ${section} work and fix one weakness`,
    (section) => `Practice: apply ${section} in a realistic role-based task`,
  ];
  let previousSection = topics[0]?.section || "Role Foundations";
  let emptySlotIndex = 0;
  topicsPerSlot.forEach((slotTopics, slotIndex) => {
    if (slotTopics.length) {
      previousSection = slotTopics[slotTopics.length - 1].section || previousSection;
      return;
    }
    const nextSection = topicsPerSlot.slice(slotIndex + 1).find((nextSlot) => nextSlot.length)?.[0]?.section;
    const section = previousSection || nextSection || "Role Foundations";
    slotTopics.push({
      number: null,
      title: practiceFormats[emptySlotIndex % practiceFormats.length](section),
      section,
    });
    emptySlotIndex += 1;
  });

  return Array.from({ length: weekCount }, (_, weekIndex) => {
    const weekTopics = topicsPerSlot.slice(weekIndex * studyDays, (weekIndex + 1) * studyDays).flat();
    const sections = [...new Set(weekTopics.map((topic) => topic.section))];
    const dailyTasks = Array.from({ length: 7 }, (_, dayIndex) => {
      if (dayIndex >= studyDays) return "Rest day or optional catch-up";
      const dailyTopics = topicsPerSlot[weekIndex * studyDays + dayIndex];
      const titles = dailyTopics.map(({ title, number }) => number ? `Topic ${number}: ${title}` : title);
      return `${titles.join(" · ")} (${hoursPerDay}h)`;
    });
    return {
      weekNumber: weekIndex + 1,
      theme: sections.length ? sections.join(" + ") : "AI Engineering Practice",
      milestones: [],
      dailyTasks,
      dailyTaskCompletions: Array(7).fill(false),
    };
  });
};

const buildCustomRoleTrack = async ({ targetRole, currentSkills = [], focusAreas = "" }) => {
  const safeRole = String(targetRole || "Software Professional").trim().slice(0, 100);
  const fallbackPhases = [
    ["Role Foundations", ["role responsibilities and outcomes", "industry terminology and core concepts", "common workflows and deliverables", "stakeholders and user needs", "tools and professional standards", "how to assess role requirements"]],
    ["Core Knowledge", ["foundational principles", "methods and decision frameworks", "requirements and constraints", "planning and prioritization", "documentation and communication", "common risks and failure modes"]],
    ["Tools and Workflows", ["choose and configure essential tools", "follow a repeatable workflow", "organize work and track progress", "collaborate with adjacent roles", "review work and incorporate feedback", "automate a recurring task"]],
    ["Practical Delivery", ["analyze a realistic role scenario", "plan a role-specific deliverable", "create a first working version", "validate the result against requirements", "debug and resolve a realistic issue", "present the work and explain trade-offs"]],
    ["Quality and Responsibility", ["define measurable quality criteria", "test edge cases and failure conditions", "handle privacy and security responsibly", "check accessibility and inclusion where relevant", "evaluate risks and ethical considerations", "improve reliability and maintainability"]],
    ["Projects and Portfolio", ["scope a portfolio project", "build a useful end-to-end deliverable", "measure outcomes and gather feedback", "write a clear case study", "review and refine the project", "publish work with supporting documentation"]],
    ["Career Preparation", ["map skills to job descriptions", "prepare role-specific interview examples", "practice explaining technical decisions", "review job-ready expectations", "identify remaining skill gaps", "plan the next stage of professional growth"]],
  ];
  const fallbackTopics = fallbackPhases.flatMap(([section, titles]) => titles.map((title) => ({ number: null, title: `For a ${safeRole}: ${title}`, section })));
  try {
    const result = await generateAIContent({
      messages: [
        { role: "system", content: "Create a practical, accurate learning curriculum for the named job role. Return strict JSON only; do not change the target role or substitute a different profession." },
        { role: "user", content: `Build a beginner-friendly curriculum for target role: ${safeRole}. Learner skills: ${currentSkills.slice(0, 30).join(", ") || "beginner"}. Focus areas: ${String(focusAreas).slice(0, 500) || "balanced role preparation"}. Return 80 to 110 concise, ordered learning topics grouped under 6 to 10 section names, progressing from foundations to projects, quality, deployment or delivery, and career preparation. Include projects relevant to this exact role. JSON format: {"identifiedGaps":["..."],"topics":[{"title":"...","section":"..."}]}` },
      ],
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 4200,
      timeoutMs: 45000,
    });
    const topics = Array.isArray(result?.topics)
      ? result.topics.filter((topic) => typeof topic?.title === "string" && topic.title.trim()).slice(0, 120).map((topic) => ({ number: null, title: topic.title.trim().slice(0, 180), section: String(topic.section || `${safeRole} Foundations`).trim().slice(0, 80) }))
      : [];
    if (topics.length >= 30) {
      const identifiedGaps = Array.isArray(result.identifiedGaps) ? result.identifiedGaps.filter((item) => typeof item === "string").slice(0, 8) : [];
      return { topics, identifiedGaps: identifiedGaps.length ? identifiedGaps : [`Core skills for ${safeRole}`, `Practical ${safeRole} experience`, `${safeRole} project and interview readiness`] };
    }
  } catch (error) {
    console.error("Role-specific curriculum generation unavailable; using a local role plan:", error.message);
  }
  const topics = fallbackTopics;
  return { topics, identifiedGaps: [`Core skills for ${safeRole}`, `Practical ${safeRole} experience`, `${safeRole} portfolio and interview readiness`] };
};

const buildCurriculum = async ({ targetRole = "", durationWeeks = 26, hoursPerDay = 2, daysPerWeek = 5, currentSkills = [], focusAreas = "" }) => {
  const track = getRoleTrack(targetRole);
  let topics;
  let identifiedGaps;

  if (track === "dataScience") {
    topics = [...DATA_SCIENCE_TOPICS, { number: null, title: "Final Goal: Build a job-ready data science portfolio with deployed ML projects", section: "Final Goal" }];
    identifiedGaps = ["Python, SQL, statistics and exploratory analysis", "Machine learning and model evaluation", "Deployment, portfolio and interview readiness"];
  } else if (track === "aiEngineering") {
    topics = [
      ...AI_ENGINEERING_TOPICS,
      { number: null, title: "Capstone: UPSHIFT AI Roadmap Engine", section: "AI Capstone Projects" },
      { number: null, title: "Capstone: AI Tutor with RAG", section: "AI Capstone Projects" },
      { number: null, title: "Capstone: CareerTwin AI", section: "AI Capstone Projects" },
      { number: null, title: "Final Goal — Complete AI Engineering Architecture", section: "Final Goal" },
    ];
    identifiedGaps = ["Python and machine learning foundations", "LLM applications, RAG and AI agents", "Production AI security, evaluation and deployment"];
  } else if (track === "backend" || track === "fullStack") {
    return {
      identifiedGaps: ["Role-targeted backend fundamentals", "Production deployment and reliability", "System design and interview practice"],
      weeks: buildIndexWeeks({ durationWeeks, hoursPerDay, daysPerWeek }),
    };
  } else {
    const customTrack = await buildCustomRoleTrack({ targetRole, currentSkills, focusAreas });
    topics = customTrack.topics;
    identifiedGaps = customTrack.identifiedGaps;
  }

  return { identifiedGaps, weeks: buildTopicTrackWeeks({ topics, durationWeeks, hoursPerDay, daysPerWeek }) };
};

const buildDailyLesson = async ({ targetRole, weekNumber, weekTheme, dayNumber, taskTitle, difficulty = "Standard", difficultySource = "standard" }) => {
  const fallbackSummary = `This lesson covers ${taskTitle} in the context of ${weekTheme} for a ${targetRole}. You will learn the core idea, understand where it is used, work through an example, and finish with practical work that shows whether you can apply it independently.`;
  const fallbackLesson = `What you are learning\n${taskTitle} is part of ${weekTheme}. For a ${targetRole}, understand both the definition and the problem this idea helps solve. Begin with a small, familiar example, identify the inputs and expected result, then connect each step to the underlying concept.\n\nHow to reason about it\nBreak the topic into a few pieces: the main idea, the rules or constraints, how it interacts with nearby parts of the system, and what can go wrong. If today's task contains several numbered topics, make a short note for each one and explain how they relate. Avoid memorizing terms without being able to apply them.\n\nHow to apply it\nUse the walkthrough below to study, try the worked example, and then solve the practice tasks without copying the answer. Check your result against the stated requirements. Include a normal case, an edge case, and a failure case where appropriate. Write down one question that remains unclear so it can guide your next review.`;
  const fallback = {
    title: taskTitle,
    difficulty,
    difficultySource,
    summary: fallbackSummary,
    lesson: fallbackLesson,
    prerequisites: [`Basic familiarity with ${weekTheme}`, "Ability to break a problem into inputs, steps, and expected results"],
    keyConcepts: [
      `Core idea: define ${taskTitle} clearly and describe the problem it solves.`,
      `Context: explain how it connects to ${weekTheme} and the ${targetRole} workflow.`,
      "Inputs and outputs: identify what enters the process and what a correct result looks like.",
      "Constraints: note assumptions, limits, dependencies, and important trade-offs.",
      "Failure handling: identify likely errors and decide how they should be reported or recovered from.",
      "Verification: check a normal case, an edge case, and a failure case.",
    ],
    walkthrough: [
      `Restate ${taskTitle} in your own words and list the key terms.`,
      "Write down the prerequisites and one real problem this topic helps solve.",
      "Trace the steps from input or starting state to the expected result.",
      "Work through the example and explain why each step is needed.",
      "Change one input or condition and predict how the result should change.",
      "Check your reasoning, note a limitation, and summarize what you would use in practice.",
    ],
    example: `Create a small ${targetRole} example that demonstrates ${taskTitle}. State the input, expected output, assumptions, and one edge case. Explain each step, then verify the result and record what would happen if the input were invalid.`,
    commonMistakes: [
      "Memorizing a definition without applying it to an example.",
      "Ignoring assumptions, edge cases, or how the topic connects to neighboring concepts.",
      "Treating a successful first attempt as proof that the result is correct.",
      "Skipping notes about trade-offs, limitations, or failure behavior.",
    ],
    practiceTasks: [
      `Explain ${taskTitle} in your own words, with one example and one non-example.`,
      `Complete a small ${targetRole} exercise using ${taskTitle}; write down your expected result before starting.`,
      "Test one normal case, one boundary case, and one invalid or failure case.",
      "Write a short recap of what was confusing and what you can now do independently.",
    ],
    recap: [
      `Define ${taskTitle} without relying on copied wording.`,
      `Name the role it plays in ${weekTheme}.`,
      "Show that you can apply it in a small, checked example.",
      "Remember one limitation and one way to verify your result.",
    ],
    quiz: {
      question: "What is the best way to verify a new technical feature?",
      options: ["Check only the happy path", "Test normal, edge, and failure cases", "Assume the framework handles every case", "Skip validation until production"],
      correctIndex: 1,
      explanation: "Checking a normal case, an edge case, and a failure case makes behavior and error handling visible.",
    },
  };

  try {
    const result = await generateAIContent({
      messages: [
        { role: "system", content: "You are an expert, patient instructor for the learner's exact target profession. Teach concepts accurately from first principles and connect them to realistic work. Never replace a specific explanation with generic study advice. Return substantial, structured learning material and one useful multiple-choice check as strict JSON only." },
        { role: "user", content: `Create a thorough, self-contained lesson for day ${dayNumber} of week ${weekNumber} in the ${targetRole} roadmap. Week theme: ${weekTheme}. Today's task: ${taskTitle}. If this task bundles several numbered topics, explicitly teach every listed topic and explain how they connect; do not silently skip any. Adapt the explanation to ${difficulty} level. The learner wants enough depth to understand and apply the material without feeling key details are missing. Return all these fields: title (specific lesson title); summary (a clear 120-180 word overview); lesson (a detailed 450-700 word explanation in readable paragraphs, covering definition, mental model, how it works, role-specific uses, key trade-offs, edge cases, and how it connects to other topics); prerequisites (2-5 short items, or an empty array if none); keyConcepts (6-9 explained items, not just labels); walkthrough (5-8 ordered steps tailored to this topic); example (a complete worked code example, calculation, or realistic case study with expected result and explanation; choose what fits the profession); commonMistakes (4-6 concrete mistakes and why they fail); practiceTasks (3-5 exercises from basic to challenging, with a clear expected deliverable); recap (4-6 takeaways). Include one topic-specific multiple-choice quiz with exactly 4 options, a zero-based correctIndex and an explanation that teaches why the answer is right. Do not invent citations or claim current facts without support. Do not use filler. Return JSON: {"title":"...","summary":"...","lesson":"...","prerequisites":["..."],"keyConcepts":["..."],"walkthrough":["..."],"example":"...","commonMistakes":["..."],"practiceTasks":["..."],"recap":["..."],"quiz":{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}}` },
      ],
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 3600,
      timeoutMs: 45000,
    });
    if (!result || typeof result.lesson !== "string" || !result.lesson.trim()) return fallback;
    const cleanList = (value, backup, limit = 8) => {
      const items = Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).slice(0, limit) : [];
      return items.length ? items : backup;
    };
    const options = Array.isArray(result.quiz?.options) ? result.quiz.options.filter((option) => typeof option === "string").slice(0, 4) : [];
    const correctIndex = Number(result.quiz?.correctIndex);
    return {
      title: typeof result.title === "string" ? result.title : taskTitle,
      difficulty,
      difficultySource,
      summary: typeof result.summary === "string" && result.summary.trim() ? result.summary.trim().slice(0, 3000) : fallback.summary,
      lesson: result.lesson.trim().slice(0, 16000),
      prerequisites: Array.isArray(result.prerequisites) ? result.prerequisites.filter((item) => typeof item === "string" && item.trim()).slice(0, 6) : fallback.prerequisites,
      keyConcepts: cleanList(result.keyConcepts, fallback.keyConcepts, 10),
      walkthrough: cleanList(result.walkthrough, fallback.walkthrough, 10),
      example: typeof result.example === "string" && result.example.trim() ? result.example.trim().slice(0, 8000) : fallback.example,
      commonMistakes: cleanList(result.commonMistakes, fallback.commonMistakes, 8),
      practiceTasks: cleanList(result.practiceTasks, fallback.practiceTasks, 8),
      recap: cleanList(result.recap, fallback.recap, 8),
      quiz: options.length === 4 && Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex < 4
        ? { question: String(result.quiz.question || fallback.quiz.question), options, correctIndex, explanation: String(result.quiz.explanation || fallback.quiz.explanation) }
        : fallback.quiz,
    };
  } catch (error) {
    console.error("Daily roadmap lesson generation unavailable; using local lesson:", error.message);
    return fallback;
  }
};

module.exports = { buildCurriculum, buildDailyLesson, isAIEngineeringRole, getRecommendedRoadmapWeeks, getRoleTrack };
