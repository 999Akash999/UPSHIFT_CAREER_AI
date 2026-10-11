const User = require("../models/User");
const Order = require("../models/Order");
const JobApplication = require("../models/JobApplication");

const getPlatformAnalytics = async () => {
  const [totalUsers, studentCount, recruiterCount, totalRevenue, totalApplications] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "student" }),
    User.countDocuments({ role: "recruiter" }),
    Order.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    JobApplication.countDocuments(),
  ]);

  return {
    totalUsers,
    studentCount,
    recruiterCount,
    totalRevenueINR: totalRevenue[0]?.total ? totalRevenue[0].total / 100 : 0,
    totalApplications,
  };
};

module.exports = { getPlatformAnalytics };