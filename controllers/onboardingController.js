const Student = require("../models/Student");
const User = require("../models/User");

exports.renderStep = async (req, res) => {
  const { step } = req.params;
  const validSteps = ["welcome", "education", "skills", "career-goal"];

  if (!validSteps.includes(step)) {
    return res.redirect("/onboarding/welcome");
  }

  const student = await Student.findOne({ user: req.user._id });
  res.render(`onboarding/${step}`, { title: `Setup - ${step}`, student, step });
};

exports.saveEducation = async (req, res) => {
  try {
    const { college, degree, graduationYear, cgpa } = req.body;
    const parsedYear = Number.parseInt(graduationYear, 10);
    const parsedCgpa = Number.parseFloat(cgpa);
    if (graduationYear && (!Number.isInteger(parsedYear) || parsedYear < 1950 || parsedYear > 2100)) {
      req.flash("error", "Enter a valid graduation year.");
      return res.redirect("/onboarding/education");
    }
    if (cgpa && (!Number.isFinite(parsedCgpa) || parsedCgpa < 0 || parsedCgpa > 10)) {
      req.flash("error", "CGPA must be between 0 and 10.");
      return res.redirect("/onboarding/education");
    }
    await Student.findOneAndUpdate(
      { user: req.user._id },
      {
        "academicDetails.college": college,
        "academicDetails.degree": degree,
        "academicDetails.graduationYear": parsedYear || undefined,
        "academicDetails.cgpa": Number.isFinite(parsedCgpa) ? parsedCgpa : 0,
      }
    );
    res.redirect("/onboarding/skills");
  } catch (err) {
    req.flash("error", "Failed to save educational background.");
    res.redirect("/onboarding/education");
  }
};

exports.saveSkills = async (req, res) => {
  try {
    const { skills } = req.body;
    const submittedSkills = Array.isArray(skills)
      ? skills
      : String(skills || "").split(/[\n,]/);
    const skillList = [...new Map(submittedSkills
      .map((skill) => String(skill || "").trim().replace(/\s+/g, " ").slice(0, 50))
      .filter(Boolean)
      .map((skill) => [skill.toLocaleLowerCase(), skill])).values()];
    if (!skillList.length) {
      req.flash("error", "Add at least one skill before continuing.");
      return res.redirect("/onboarding/skills");
    }
    if (skillList.length > 30) {
      req.flash("error", "You can add up to 30 skills.");
      return res.redirect("/onboarding/skills");
    }

    const student = await Student.findOneAndUpdate(
      { user: req.user._id },
      { $set: { skills: skillList } },
      { new: true, runValidators: true }
    );
    if (!student) {
      req.flash("error", "Student profile was not found. Please restart onboarding.");
      return res.redirect("/onboarding/welcome");
    }
    res.redirect("/onboarding/career-goal");
  } catch (err) {
    req.flash("error", "Failed to save skills.");
    res.redirect("/onboarding/skills");
  }
};

exports.completeOnboarding = async (req, res) => {
  try {
    const { targetRole, primaryDomain } = req.body;
    await Student.findOneAndUpdate(
      { user: req.user._id },
      { targetRole, primaryDomain }
    );

    await User.findByIdAndUpdate(req.user._id, { isOnboarded: true });

    req.flash("success", "Profile set up! Welcome to your career dashboard.");
    res.redirect("/student/dashboard");
  } catch (err) {
    req.flash("error", "Could not complete profile setup.");
    res.redirect("/onboarding/career-goal");
  }
};
