const MentorProfile = require("../models/MentorProfile");
const MentorshipBooking = require("../models/MentorshipBooking");
const Course = require("../models/Course");

const courseCategories = ["Full Stack", "Data Science & AI", "DevOps & Cloud", "System Design", "Core CS"];

const slugify = (value) => String(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);

exports.getDashboard = async (req, res) => {
  const [mentorProfile, upcomingBookings, completedCount, courses, recentReviews] = await Promise.all([
    MentorProfile.findOne({ user: req.user._id }),
    MentorshipBooking.find({ mentor: req.user._id, sessionDate: { $gte: new Date() }, status: { $in: ["pending", "confirmed"] } })
    .populate("student")
    .sort({ sessionDate: 1 }).limit(5),
    MentorshipBooking.countDocuments({ mentor: req.user._id, status: "completed" }),
    Course.countDocuments({ instructor: req.user._id }),
    MentorshipBooking.find({ mentor: req.user._id, "review.rating": { $exists: true } })
      .populate("student", "name").sort({ "review.submittedAt": -1 }).limit(3),
  ]);

  res.render("mentor/dashboard", {
    title: "Mentor Portal", mentorProfile, upcomingBookings,
    upcomingCount: upcomingBookings.length, completedCount, courseCount: courses,
    earnings: completedCount * (mentorProfile?.hourlyRate || 0),
    recentReviews,
  });
};

exports.getCourses = async (req, res) => {
  const courses = await Course.find({ instructor: req.user._id }).sort({ updatedAt: -1 });
  res.render("mentor/courses", { title: "My Courses", courses });
};

exports.getNewCourse = (req, res) => res.render("mentor/course-form", {
  title: "Create Course", course: null, categories: courseCategories,
});

exports.createCourse = async (req, res) => {
  try {
    const { title, description, category, level, price, discountPrice, thumbnail, targetSkillGaps, moduleTitle, lessons } = req.body;
    const cleanTitle = String(title || "").trim();
    const cleanDescription = String(description || "").trim();
    const numericPrice = Number(price);
    if (cleanTitle.length < 5 || cleanDescription.length < 30 || !courseCategories.includes(category) || !Number.isFinite(numericPrice) || numericPrice < 0) {
      req.flash("error", "Add a course title, description (at least 30 characters), category, and valid price.");
      return res.redirect("/mentor/courses/new");
    }
    if (Number(discountPrice) > 0 && Number(discountPrice) > numericPrice) {
      req.flash("error", "Discount price cannot be higher than the course price.");
      return res.redirect("/mentor/courses/new");
    }

    const parsedLessons = String(lessons || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const [lessonTitle, videoUrl = "", duration = "0"] = line.split("|").map((part) => part.trim());
      return { title: lessonTitle, videoUrl, durationMinutes: Math.max(0, Number(duration) || 0) };
    });
    if (!parsedLessons.length) {
      req.flash("error", "Add at least one lesson before publishing the course.");
      return res.redirect("/mentor/courses/new");
    }

    const baseSlug = slugify(cleanTitle) || `course-${Date.now()}`;
    let slug = baseSlug;
    let suffix = 2;
    while (await Course.exists({ slug })) slug = `${baseSlug}-${suffix++}`;
    const gaps = Array.isArray(targetSkillGaps) ? targetSkillGaps : String(targetSkillGaps || "").split(",");
    await Course.create({
      title: cleanTitle, slug, description: cleanDescription,
      instructor: req.user._id, price: numericPrice,
      discountPrice: Number(discountPrice) > 0 ? Number(discountPrice) : 0,
      thumbnail: String(thumbnail || "").trim() || undefined,
      category, level: ["Beginner", "Intermediate", "Advanced"].includes(level) ? level : "Beginner",
      targetSkillGaps: gaps.map((gap) => String(gap).trim()).filter(Boolean),
      modules: [{ title: String(moduleTitle || "Course lessons").trim(), lessons: parsedLessons }],
      isPublished: req.body.isPublished === "on",
    });
    req.flash("success", req.body.isPublished === "on" ? "Course saved and published to the course catalog." : "Course saved as a draft.");
    res.redirect("/mentor/courses");
  } catch (error) {
    console.error("Mentor course creation failed:", error);
    req.flash("error", "Course could not be saved. Check the fields and try again.");
    res.redirect("/mentor/courses/new");
  }
};

exports.toggleCoursePublication = async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, instructor: req.user._id });
    if (!course) return res.status(404).render("errors/404", { title: "Course not found" });
    course.isPublished = !course.isPublished;
    await course.save();
    req.flash("success", course.isPublished ? "Course published." : "Course moved to drafts.");
    res.redirect("/mentor/courses");
  } catch (error) {
    req.flash("error", "Could not update course visibility.");
    res.redirect("/mentor/courses");
  }
};

exports.getSlots = async (req, res) => {
  const mentorProfile = await MentorProfile.findOne({ user: req.user._id });
  res.render("mentor/slots", { title: "Availability", mentorProfile });
};

exports.getSessions = async (req, res) => {
  const bookings = await MentorshipBooking.find({ mentor: req.user._id })
    .populate("student", "name email")
    .sort({ sessionDate: 1 });
  res.render("mentor/sessions", { title: "Mentor Sessions", bookings });
};

exports.updateAvailability = async (req, res) => {
  try {
    const { slots, hourlyRate, bio, defaultMeetingLink, activeDays } = req.body;
    const updates = {};
    if (slots !== undefined || activeDays !== undefined) {
      if (slots !== undefined) {
        updates.availability = Array.isArray(slots) ? slots : JSON.parse(slots || "[]");
      } else {
        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const selectedDays = Array.isArray(activeDays) ? activeDays : activeDays ? [activeDays] : [];
        updates.availability = selectedDays.map((day) => ({
          dayOfWeek: days.indexOf(day),
          startTime: req.body[`startTime_${day}`] || "18:00",
          endTime: req.body[`endTime_${day}`] || "21:00",
        })).filter((slot) => slot.dayOfWeek >= 0 && slot.startTime < slot.endTime);
      }
    }
    if (hourlyRate !== undefined && Number.isFinite(Number(hourlyRate))) updates.hourlyRate = Number(hourlyRate);
    if (bio !== undefined) updates.bio = bio;
    if (defaultMeetingLink !== undefined) updates.defaultMeetingLink = defaultMeetingLink;
    await MentorProfile.findOneAndUpdate({ user: req.user._id }, { $set: updates }, { upsert: true, runValidators: true });
    req.flash("success", "Availability schedule saved.");
    res.redirect("/mentor/dashboard");
  } catch (err) {
    req.flash("error", "Failed to save schedule.");
    res.redirect("/mentor/dashboard");
  }
};

exports.bookSession = async (req, res) => {
  try {
    const { mentorId, sessionDate, agenda } = req.body;
    const sessionDateValue = new Date(sessionDate);
    if (!Number.isFinite(sessionDateValue.getTime()) || sessionDateValue <= new Date()) {
      req.flash("error", "Choose a future session time.");
      return res.redirect(`/student/mentorship/book/${mentorId}`);
    }
    const mentorProfile = await MentorProfile.findOne({ user: mentorId });
    if (!mentorProfile) {
      req.flash("error", "Mentor not found.");
      return res.redirect("/student/mentorship");
    }
    await MentorshipBooking.create({
      mentor: mentorId,
      student: req.user._id,
      sessionDate: sessionDateValue,
      agenda,
      meetingLink: mentorProfile.defaultMeetingLink || "",
      status: "pending",
    });
    req.flash("success", "Session booked successfully. Awaiting mentor confirmation.");
    res.redirect("/student/mentorship");
  } catch (err) {
    req.flash("error", "Could not create booking.");
    res.redirect("/student/mentorship");
  }
};
