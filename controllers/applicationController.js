const JobApplication = require("../models/JobApplication");
const Job = require("../models/Job");
const EmployabilitySnapshot = require("../models/EmployabilitySnapshot");
const path = require("path");

exports.applyToJob = async (req, res) => {
  try {
    const { jobId, resumeUrl, coverNote } = req.body;
    const job = await Job.findOne({ _id: jobId, status: "active" });
    if (!job) {
      req.flash("error", "This job is no longer accepting applications.");
      return res.redirect("/student/jobs");
    }
    const snapshot = await EmployabilitySnapshot.findOne({ student: req.student._id }).sort({ createdAt: -1 });
    const storedResume = req.file ? `/applications/${req.user._id}/resume/${req.file.filename}` : resumeUrl;
    if (!storedResume) {
      req.flash("error", "Upload a PDF resume or provide a resume link.");
      return res.redirect(`/student/jobs/${job._id}`);
    }
    await JobApplication.create({
      student: req.user._id,
      job: jobId,
      resumeUrl: storedResume,
      coverNote,
      employabilityScoreAtApplication: snapshot?.overallScore || 0,
      status: "applied",
    });
    req.flash("success", "Application submitted.");
    res.redirect("/student/applications");
  } catch (err) {
    req.flash("error", "Failed to submit application.");
    res.redirect("/student/jobs");
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ["applied", "shortlisted", "interviewing", "offered", "rejected"];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: "Invalid application status." });
    const application = await JobApplication.findById(req.params.applicationId).populate("job");
    if (!application) return res.status(404).json({ error: "Application not found." });
    if (req.user.role !== "admin" && (req.user.role !== "recruiter" || String(application.job.recruiter) !== String(req.user._id))) {
      return res.status(403).json({ error: "You cannot update this application." });
    }
    application.status = status;
    await application.save();
    if (req.accepts("html")) {
      req.flash("success", "Application status updated.");
      return res.redirect(`/recruiter/applications/${application._id}`);
    }
    res.json({ success: true, status: application.status });
  } catch (err) {
    res.status(500).json({ error: "Could not update status." });
  }
};

exports.downloadResume = async (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const application = await JobApplication.findOne({
    student: req.params.ownerId,
    resumeUrl: `/applications/${req.params.ownerId}/resume/${safeFilename}`,
  }).populate("job", "recruiter");
  if (!application) return res.status(404).send("Resume not found.");
  const canRead =
    String(req.user._id) === String(application.student) ||
    req.user.role === "admin" ||
    (req.user.role === "recruiter" && String(application.job.recruiter) === String(req.user._id));
  if (!canRead) return res.status(403).send("You cannot access this resume.");
  const filename = path.join(__dirname, "../uploads/resumes", safeFilename);
  res.type("application/pdf").sendFile(filename, (error) => {
    if (error && !res.headersSent) res.status(error.statusCode || 404).send("Resume file is unavailable.");
  });
};
