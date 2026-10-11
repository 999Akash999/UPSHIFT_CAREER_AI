const session = require("express-session");
const MongoStoreModule = require("connect-mongo");
const MongoStore = MongoStoreModule.default || MongoStoreModule.MongoStore || MongoStoreModule;

const createSessionMiddleware = () => {
  const isProduction = process.env.NODE_ENV === "production";
  const dbUrl = process.env.ATLASDB_URL;
  const sessionSecret = process.env.SECRET || "upshift-fallback-secret-2026";

  if (!dbUrl) {
    throw new Error("ATLASDB_URL must be defined for session persistence.");
  }

  const store = MongoStore.create({
    mongoUrl: dbUrl,
    touchAfter: 24 * 3600, // Lazy update: once per 24 hours unless data changes
    crypto: {
      secret: sessionSecret,
    },
    collectionName: "sessions",
  });

  store.on("error", (err) => {
    console.error("❌ MongoStore Session Error:", err);
  });

  return session({
    store,
    name: "upshift.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Days
    },
  });
};

module.exports = createSessionMiddleware;
