const cron = require("node-cron");
const dailyReminderJob = require("../jobs/dailyReminderJob");
const weeklyProgressJob = require("../jobs/weeklyProgressJob");
const deadlineReminderJob = require("../jobs/deadlineReminderJob");

const initCronJobs = () => {
  console.log("⏱️ Initializing background cron jobs...");

  // 1. Daily morning reminder at 08:00 AM IST
  cron.schedule("0 8 * * *", async () => {
    console.log("⏰ Running Daily Task Reminder Job [08:00 AM]");
    try {
      if (typeof dailyReminderJob === "function") await dailyReminderJob();
    } catch (err) {
      console.error("❌ Daily Reminder Job failed:", err.message);
    }
  }, { timezone: "Asia/Kolkata" });

  // 2. Midnight Streak Evaluation at 00:01 AM IST
  cron.schedule("1 0 * * *", async () => {
    console.log("⏰ Running Midnight Streak Reset Evaluator [00:01 AM]");
    try {
      if (typeof deadlineReminderJob === "function") await deadlineReminderJob();
    } catch (err) {
      console.error("❌ Streak Evaluator failed:", err.message);
    }
  }, { timezone: "Asia/Kolkata" });

  // 3. Weekly Progress Digest every Sunday at 08:00 PM IST
  cron.schedule("0 20 * * 0", async () => {
    console.log("⏰ Running Sunday Weekly Digest Job [08:00 PM]");
    try {
      if (typeof weeklyProgressJob === "function") await weeklyProgressJob();
    } catch (err) {
      console.error("❌ Weekly Progress Job failed:", err.message);
    }
  }, { timezone: "Asia/Kolkata" });
};

module.exports = initCronJobs;