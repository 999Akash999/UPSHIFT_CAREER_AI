const Job = require("../models/Job");
const JobApplication = require("../models/JobApplication");
const RecruiterProfile = require("../models/RecruiterProfile");
const Student = require("../models/Student");
const EmployabilitySnapshot = require("../models/EmployabilitySnapshot");
const Project = require("../models/Project");
const Roadmap = require("../models/Roadmap");
const SkillAssessment = require("../models/SkillAssessment");
const RecruiterInterview = require("../models/RecruiterInterview");
const RecruiterConversation = require("../models/RecruiterConversation");
const { getRoleSkillProgress } = require("../services/skillGapService");

exports.getDashboard = async (req, res) => {
  const profile = await RecruiterProfile.findOne({ user: req.user._id }).populate("company");
  const activeJobs = await Job.find({ recruiter: req.user._id, status: "active" });
  const jobIds = activeJobs.map((job) => job._id);
  const [totalApplications, shortlistedCount, interviewsScheduledCount, recentApplicants] = await Promise.all([
    JobApplication.countDocuments({ job: { $in: jobIds } }),
    JobApplication.countDocuments({ job: { $in: jobIds }, status: "shortlisted" }),
    JobApplication.countDocuments({ job: { $in: jobIds }, status: "interviewing" }),
    JobApplication.find({ job: { $in: jobIds } })
      .populate("student", "name email")
      .populate("job", "title")
      .sort({ createdAt: -1 }).limit(10),
  ]);

  res.render("recruiter/dashboard", {
    title: "Recruiter Portal",
    profile,
    activeJobs,
    totalApplications,
    activeJobsCount: activeJobs.length,
    totalApplicantsCount: totalApplications,
    shortlistedCount,
    interviewsScheduledCount,
    recentApplicants,
  });
};

exports.getManageJobs = async (req, res) => {
  const jobs = await Job.find({ recruiter: req.user._id }).sort({ createdAt: -1 }).lean();
  await Promise.all(jobs.map(async (job) => {
    job.applicantCount = await JobApplication.countDocuments({ job: job._id });
    job.jobType = job.type;
    job.minEmployabilityScore = job.minScoreCutoff;
  }));
  res.render("recruiter/manage-jobs", { title: "Manage Job Postings", jobs });
};

exports.getJobApplicants = async (req, res) => {
  const job = await Job.findOne({ _id: req.params.jobId, recruiter: req.user._id });
  if (!job) return res.status(404).render("errors/404", { title: "Job not found" });
  const applicants = await JobApplication.find({ job: job._id }).populate("student", "name email").sort({ createdAt: -1 });
  res.render("recruiter/applicants", { title: `Applicants · ${job.title}`, job, applicants });
};

exports.getApplication = async (req, res) => {
  const application = await JobApplication.findById(req.params.applicationId)
    .populate("student", "name email")
    .populate("job", "title recruiter");
  if (!application || String(application.job.recruiter) !== String(req.user._id)) {
    return res.status(404).render("errors/404", { title: "Application not found" });
  }
  const Student = require("../models/Student");
  const student = await Student.findOne({ user: application.student._id });
  res.render("recruiter/applicant-review", { title: "Applicant Review", application, student });
};

exports.getCandidate = async (req, res) => {
  const candidate = await Student.findById(req.params.studentId).populate("user", "name email avatar");
  if (!candidate?.user) return res.status(404).render("errors/404", { title: "Candidate not found" });
  const recruiterJobs = await Job.find({ recruiter: req.user._id }).select("_id title status").sort({ createdAt: -1 }).lean();
  const jobIds = recruiterJobs.map((job) => job._id);
  const [snapshot, projects, roadmap, skillProgress, assessments, applications, interviews, conversation] = await Promise.all([
    EmployabilitySnapshot.findOne({ student: candidate._id }).sort({ createdAt: -1 }).lean(),
    Project.find({ student: candidate.user._id }).sort({ createdAt: -1 }).lean(),
    Roadmap.findOne({ student: candidate._id, status: "in-progress" }).sort({ createdAt: -1 }).select("title targetRole completionPercentage weeks updatedAt").lean(),
    getRoleSkillProgress(candidate.user._id, candidate.targetRole).catch((error) => {
      console.error("Candidate skill assessment breakdown unavailable:", error.message);
      return [];
    }),
    SkillAssessment.find({ student: candidate.user._id }).populate("assessment", "title domain").sort({ createdAt: -1 }).limit(20).lean(),
    JobApplication.find({ student: candidate.user._id, job: { $in: jobIds } }).populate({ path: "job", populate: { path: "company" } }).sort({ updatedAt: -1 }).lean(),
    RecruiterInterview.find({ recruiter: req.user._id, student: candidate.user._id }).populate("job", "title").sort({ scheduledAt: -1 }).lean(),
    RecruiterConversation.findOne({ recruiter: req.user._id, student: candidate.user._id }).select("_id"),
  ]);
  res.render("recruiter/candidate-profile", {
    title: "Candidate Profile",
    candidate,
    snapshot,
    projects,
    roadmap,
    skillProgress,
    assessments,
    applications,
    interviews,
    recruiterJobs,
    conversationId: conversation?._id || null,
  });
};

exports.renderPostJob = (req, res) => {
  res.render("recruiter/post-job", { title: "Create Job Listing" });
};

exports.createJob = async (req, res) => {
  try {
    const { title, description, skillsRequired, minEmployabilityScore, salaryRange, location, jobType } = req.body;

    const parsedSkills = String(skillsRequired || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!parsedSkills.length) throw new Error("Add at least one required skill.");
    const profile = await RecruiterProfile.findOne({ user: req.user._id });

    await Job.create({
      recruiter: req.user._id,
      company: profile?.company,
      title,
      description,
      requiredSkills: parsedSkills,
      minScoreCutoff: parseInt(minEmployabilityScore, 10) || 60,
      salary: salaryRange,
      location,
      type: jobType || "Full-Time",
      status: "active",
    });

    req.flash("success", "Job posted successfully!");
    res.redirect("/recruiter/dashboard");
  } catch (err) {
    req.flash("error", "Failed to create job posting.");
    res.redirect("/recruiter/post-job");
  }
};

exports.searchCandidates = async (req, res) => {
  const { minScore, query, batch } = req.query;
  const filter = {};

  if (query) {
    const safeQuery = String(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { skills: { $regex: safeQuery, $options: "i" } },
      { targetRole: { $regex: safeQuery, $options: "i" } },
    ];
  }
  if (batch && batch !== "all" && /^\d{4}$/.test(batch)) filter["academicDetails.graduationYear"] = Number(batch);

  const candidates = await Student.find(filter).populate("user", "name email").limit(100).lean();
  const snapshots = await EmployabilitySnapshot.find({ student: { $in: candidates.map((candidate) => candidate._id) } })
    .sort({ createdAt: -1 }).lean();
  const scores = new Map();
  for (const snapshot of snapshots) if (!scores.has(String(snapshot.student))) scores.set(String(snapshot.student), snapshot.overallScore);
  const minimum = Math.max(0, Math.min(100, Number(minScore) || 0));
  const filtered = candidates.map((candidate) => ({
    ...candidate,
    employabilityScore: scores.get(String(candidate._id)) || 0,
  })).filter((candidate) => candidate.employabilityScore >= minimum);

  res.render("recruiter/candidate-search", {
    title: "Find Verified Candidates",
    candidates: filtered,
    query: { minScore, query, batch },
  });
};
