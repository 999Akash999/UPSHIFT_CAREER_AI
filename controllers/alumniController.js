const AlumniProfile = require("../models/AlumniProfile");
const AlumniEvent = require("../models/AlumniEvent");
const ReferralRequest = require("../models/ReferralRequest");
const EmployabilitySnapshot = require("../models/EmployabilitySnapshot");
const Student = require("../models/Student");

exports.getDirectory = async (req, res) => {
  const { company, batch } = req.query;
  const filter = {};
  if (company) filter.currentCompany = new RegExp(String(company).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (batch) filter.graduationBatch = parseInt(batch, 10);

  const profiles = await AlumniProfile.find(filter).populate("user", "name email");
  const alumni = profiles.map((profile) => ({
    _id: profile._id,
    name: profile.user?.name || "Alumni",
    email: profile.user?.email,
    company: profile.currentCompany,
    designation: profile.designation,
    graduationBatch: profile.graduationBatch,
  }));
  res.render("student/alumni-directory", { title: "Alumni Directory", alumni });
};

exports.getDashboard = async (req, res) => {
  const [profile, myEvents, referralRequests, acceptedReferrals, hostedEventsCount] = await Promise.all([
    AlumniProfile.findOne({ user: req.user._id }),
    AlumniEvent.find({ host: req.user._id, scheduledAt: { $gte: new Date() } }).sort({ scheduledAt: 1 }).limit(3),
    ReferralRequest.find({ alumni: req.user._id, status: "pending" }).populate("student", "name email").sort({ createdAt: -1 }).limit(10),
    ReferralRequest.countDocuments({ alumni: req.user._id, status: "accepted" }),
    AlumniEvent.countDocuments({ host: req.user._id }),
  ]);
  res.render("alumni/dashboard", {
    title: "Alumni Dashboard",
    profile,
    myEvents,
    referralRequests,
    pendingReferrals: referralRequests.length,
    acceptedReferrals,
    hostedEventsCount,
  });
};

exports.getMyEvents = async (req, res) => {
  const myEvents = await AlumniEvent.find({ host: req.user._id }).sort({ scheduledAt: -1 });
  res.render("alumni/my-events", { title: "My Events", myEvents });
};

exports.getReferrals = async (req, res) => {
  const referrals = await ReferralRequest.find({ alumni: req.user._id }).populate("student", "name email").sort({ createdAt: -1 });
  res.render("alumni/referrals", { title: "Referral Requests", referrals });
};

exports.requestReferral = async (req, res) => {
  const alumniProfile = await AlumniProfile.findById(req.params.profileId);
  if (!alumniProfile || String(alumniProfile.user) === String(req.user._id)) {
    req.flash("error", "That alumni profile is unavailable.");
    return res.redirect("/alumni/directory");
  }
  const student = await Student.findOne({ user: req.user._id });
  const snapshot = student ? await EmployabilitySnapshot.findOne({ student: student._id }).sort({ createdAt: -1 }) : null;
  await ReferralRequest.findOneAndUpdate(
    { student: req.user._id, alumni: alumniProfile.user },
    {
      $setOnInsert: {
        student: req.user._id,
        alumni: alumniProfile.user,
        targetRole: student?.targetRole,
        employabilityScore: snapshot?.overallScore || 0,
        status: "pending",
      },
    },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  req.flash("success", "Referral request sent.");
  res.redirect("/alumni/directory");
};

exports.updateReferralStatus = async (req, res) => {
  const { status } = req.body;
  if (!["accepted", "declined"].includes(status)) return res.status(400).send("Invalid referral status.");
  const referral = await ReferralRequest.findOneAndUpdate(
    { _id: req.params.referralId, alumni: req.user._id, status: "pending" },
    { status },
    { new: true }
  );
  if (!referral) return res.status(404).render("errors/404", { title: "Referral request not found" });
  req.flash("success", `Referral request ${status}.`);
  res.redirect("/alumni/referrals");
};

exports.createEvent = async (req, res) => {
  try {
    const { title, description, scheduledAt, meetLink, category, capacity } = req.body;
    const eventCategory = ["hackathon", "ideathon", "webinar"].includes(category) ? category : "webinar";
    const maxCapacity = Number.isInteger(Number(capacity)) ? Math.max(1, Math.min(500, Number(capacity))) : 100;
    await AlumniEvent.create({
      host: req.user._id,
      title,
      description,
      category: eventCategory,
      scheduledAt: new Date(scheduledAt),
      meetLink,
      capacity: maxCapacity,
    });
    req.flash("success", "Alumni session scheduled.");
    res.redirect("/alumni/my-events");
  } catch (err) {
    req.flash("error", "Failed to create session.");
    res.redirect("/alumni/my-events");
  }
};
