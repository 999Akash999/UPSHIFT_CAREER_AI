require("dotenv").config();
const http = require("http");
const path = require("path");
const express = require("express");
const engine = require("ejs-mate");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStoreModule = require("connect-mongo");
const MongoStore = MongoStoreModule.default || MongoStoreModule.MongoStore || MongoStoreModule;
const passport = require("passport");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const compression = require("compression");
const morgan = require("morgan");
const { initSocket } = require("./config/socket");

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.ATLASDB_URL || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/upshift_career";
const SESSION_SECRET = process.env.SECRET || process.env.SESSION_SECRET;
if (process.env.NODE_ENV === "production" && !process.env.ATLASDB_URL && !process.env.MONGO_URI) {
  throw new Error("ATLASDB_URL or MONGO_URI must be set in production.");
}
if (!SESSION_SECRET) {
  throw new Error("SECRET or SESSION_SECRET must be set before starting the server.");
}

const app = express();
const server = http.createServer(app);

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`✗ Port ${PORT} is already in use. Stop the other process or set PORT to a free port.`);
  } else {
    console.error("✗ HTTP server failed to start:", err);
  }
  mongoose.connection.close().finally(() => process.exit(1));
});

// Configure the same password and OAuth strategies used by the auth routes.
require("./config/passport");

// ==========================================
// 4. VIEW ENGINE & MIDDLEWARE PIPELINE
// ==========================================
app.engine("ejs", engine);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "media")));
app.use("/uploads/avatars", express.static(path.join(__dirname, "uploads/avatars")));
app.use("/uploads/projects", express.static(path.join(__dirname, "uploads/projects")));
app.use((req, res, next) => {
  ["body", "params", "headers"].forEach((key) => {
    if (req[key]) req[key] = mongoSanitize.sanitize(req[key]);
  });

  // Express 5 creates a fresh query object whenever req.query is read. Keep
  // the sanitized copy on this request so downstream handlers see the result.
  if (req.query) {
    const sanitizedQuery = mongoSanitize.sanitize({ ...req.query });
    Object.defineProperty(req, "query", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: sanitizedQuery
    });
  }
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://checkout.razorpay.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net"
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
        connectSrc: ["'self'", "ws:", "wss:", "https://api.razorpay.com"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// Session Store Setup
mongoose.set("strictQuery", true);
const databaseConnectionPromise = mongoose.connect(MONGO_URI);
const sessionClientPromise = databaseConnectionPromise.then(() => mongoose.connection.getClient());
const sessionStore = MongoStore.create({
  clientPromise: sessionClientPromise,
  crypto: { secret: SESSION_SECRET },
  touchAfter: 24 * 3600
});
// connect-mongo creates this promise during construction. Consume an early
// rejection; startup awaits it below and reports the connection failure there.
sessionStore.collectionP.catch(() => {});
sessionStore.on("error", (err) => console.error("Session store error:", err.message));

const sessionMiddleware = session({
    store: sessionStore,
    name: "upshift_sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7,
      sameSite: "lax"
    }
  });
app.use(sessionMiddleware);
const io = initSocket(server, sessionMiddleware);
app.set("io", io);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Global View Context
app.use((req, res, next) => {
  res.locals.currUser = req.user || null;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currentPath = req.path;
  next();
});

// ==========================================
// 5. ROUTE MOUNTING
// ==========================================
app.use("/", require("./routes/authRoutes"));
app.use("/auth", require("./routes/oauthRoutes"));
app.use("/onboarding", require("./routes/onboardingRoutes"));
// Mount specific student feature routers before the broader /student router.
app.use("/student/projects", require("./routes/projectRoutes"));
app.use("/student/dsa", require("./routes/dsaRoutes"));
app.use("/student/events", require("./routes/eventRoutes"));
app.use("/student/daily-tasks", require("./routes/dailyTaskRoutes"));
app.use("/student/roadmap", require("./routes/roadmapRoutes"));
app.use("/student/skill-gap", require("./routes/skillGapRoutes"));
app.use("/student/employability", require("./routes/employabilityRoutes"));
app.use("/student", require("./routes/studentRoute"));
app.use("/applications", require("./routes/resumeRoutes"));
app.use("/roadmap", require("./routes/roadmapRoutes"));
app.use("/student/ai-tutor", require("./routes/aiTutorRoutes"));
app.use("/student/ai-coach", require("./routes/aiCoachRoutes"));
app.use("/ai/tutor", require("./routes/aiTutorRoutes"));
app.use("/ai/coach", require("./routes/aiCoachRoutes"));
app.use("/student/assessments", require("./routes/assessmentRoutes"));
app.use("/student/interview", require("./routes/interviewRoutes"));
app.use("/student/applications", require("./routes/applicationRoutes"));
app.use("/student/doubts", require("./routes/doubtRoutes"));
app.use("/student/notifications", require("./routes/notificationRoutes"));
app.use("/student/settings", require("./routes/settingsRoutes"));
app.use("/student/resources", require("./routes/learningResourceRoutes"));
app.use("/student/jobs", require("./routes/jobRoutes"));
app.use("/recruiter", require("./routes/recruiterRoutes"));
app.use("/recruiter/applications", require("./routes/applicationRoutes"));
app.use("/mentor", require("./routes/mentorRoutes"));
app.use("/alumni", require("./routes/alumniRoutes"));
app.use("/admin", require("./routes/adminRoutes"));
app.use("/courses", require("./routes/courseRoutes"));
app.use("/payments", require("./routes/paymentRoutes"));
app.use("/jobs", require("./routes/jobRoutes"));
app.use("/companies", require("./routes/companyRoutes"));

// Core Root Redirection
app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect(`/${req.user.role}/dashboard`);
  }
  res.render("landing", { title: "UPSHIFT CAREER | AI-Powered Career Operating System" });
});

app.get("/mentorship", (req, res) => {
  if (req.isAuthenticated()) return res.redirect("/student/mentorship");
  res.redirect("/login");
});

app.use("/", require("./routes/publicPageRoutes"));

// 404 Route Handler
app.use((req, res) => {
  if (req.xhr || req.get("accept")?.includes("application/json")) {
    return res.status(404).json({ success: false, error: "The requested API endpoint was not found. Please refresh the page and try again." });
  }
  res.status(404).render("errors/404", {
    title: "404 - Not Found",
    message: "Endpoint does not map to any active workspace controller."
  });
});

// Reuse the shared formatter so API requests get JSON and HTML gets safe error pages.
app.use(require("./middlewares/errorHandler"));

// ==========================================
// 8. DATABASE CONNECTION & SERVER BOOTSTRAP
// ==========================================
databaseConnectionPromise
  .then(async () => {
    console.log("✓ MongoDB Connected Successfully.");
    await sessionStore.collectionP;
    console.log("✓ Session store connected successfully.");
    await require("./services/eventRegistrationService").syncRegistrationCounts();
    console.log("✓ Event registration counts synchronized.");
    const assessmentCount = await require("./services/assessmentSeedService").ensureSkillAssessments();
    console.log(`✓ ${assessmentCount} skill assessments are ready.`);
    if (process.env.TURSO_URL) {
      try {
        const dsaQuestions = require("./data/codePracticeQuestionBank");
        await require("./services/dsaTursoService").initialize(dsaQuestions);
        console.log(`✓ Turso DSA store ready (${dsaQuestions.length} seed questions synchronized).`);
      } catch (error) {
        console.error("⚠ Turso DSA store is unavailable; DSA practice will retry on request:", error.message);
      }
    }
    require("./jobs")();
    server.listen(PORT, () => {
      console.log(`✓ UPSHIFT CAREER Server live at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("✗ Backend startup failed:", err);
    process.exit(1);
  });

// Graceful Process Termination
const shutdown = () => {
  console.log("\nInitiating server shutdown...");
  server.close(async () => {
    await require("./services/dsaTursoService").close().catch((error) => {
      console.error("Turso DSA store shutdown failed:", error.message);
    });
    await mongoose.connection.close();
    console.log("✓ Server and Database connections closed.");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
