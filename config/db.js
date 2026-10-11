const mongoose = require("mongoose");

const connectDB = async () => {
  const dbUrl = process.env.ATLASDB_URL;
  if (!dbUrl) {
    console.error("❌ Fatal Error: ATLASDB_URL is missing in environment variables.");
    process.exit(1);
  }

  const options = {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 20,
    minPoolSize: 5,
    socketTimeoutMS: 45000,
  };

  try {
    const conn = await mongoose.connect(dbUrl, options);
    console.log(`✅ MongoDB Connected: ${conn.connection.host} [DB: ${conn.connection.name}]`);
    return conn;
  } catch (err) {
    console.error(`❌ MongoDB Initial Connection Failed: ${err.message}`);
    process.exit(1);
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB Disconnected. Waiting for reconnection...");
});

mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB Reconnected successfully.");
});

module.exports = connectDB;