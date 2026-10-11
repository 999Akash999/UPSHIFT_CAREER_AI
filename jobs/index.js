const cron = require("node-cron");
const dailyReminderJob = require("./dailyReminderJob");
const streakEvaluatorJob = require("./streakEvaluatorJob");
const weeklyProgressJob = require("./weeklyProgressJob");
const deadlineReminderJob = require("./deadlineReminderJob");

const initJobs = () => {
  console.log("🕒 Initializing unified background cron jobs...");

  const cronOptions = {
    scheduled: true,
    timezone: "Asia/Kolkata",
  };

  // 1. Daily Morning Task Reminders - 08:00 AM IST
  cron.schedule(
    "0 8 * * *",
    async () => {
      try {
        await dailyReminderJob();
      } catch (err) {
        console.error("❌ Error running dailyReminderJob:", err.message);
      }
    },
    cronOptions
  );

  // 2. Midnight Streak Evaluator - 00:01 AM IST
  cron.schedule(
    "1 0 * * *",
    async () => {
      try {
        await streakEvaluatorJob();
      } catch (err) {
        console.error("❌ Error running streakEvaluatorJob:", err.message);
      }
    },
    cronOptions
  );

  // 3. Weekly Sunday Summary - 08:00 PM IST (Sunday)
  cron.schedule(
    "0 20 * * 0",
    async () => {
      try {
        await weeklyProgressJob();
      } catch (err) {
        console.error("❌ Error running weeklyProgressJob:", err.message);
      }
    },
    cronOptions
  );

  // 4. Upcoming Deadlines & Event Reminders - Every 4 hours (at minute 0)
  cron.schedule(
    "0 */4 * * *",
    async () => {
      try {
        await deadlineReminderJob();
      } catch (err) {
        console.error("❌ Error running deadlineReminderJob:", err.message);
      }
    },
    cronOptions
  );

  console.log("✅ All background cron jobs registered and scheduled in Asia/Kolkata timezone.");
};

module.exports = initJobs;