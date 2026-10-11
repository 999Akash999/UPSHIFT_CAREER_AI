module.exports = {
  // System Roles
  ROLES: {
    STUDENT: "student",
    ALUMNI: "alumni",
    RECRUITER: "recruiter",
    MENTOR: "mentor",
    ADMIN: "admin",
  },

  // Employability Score Weights
  EMPLOYABILITY_WEIGHTS: {
    ASSESSMENTS: 0.35,
    PROJECTS: 0.25,
    ROADMAP_PROGRESS: 0.25,
    INTERVIEWS: 0.15,
  },

  // Application Pipeline States
  APPLICATION_STATUS: {
    APPLIED: "applied",
    SHORTLISTED: "shortlisted",
    INTERVIEWING: "interviewing",
    OFFERED: "offered",
    REJECTED: "rejected",
    WITHDRAWN: "withdrawn",
  },

  // Mentorship Booking Statuses
  BOOKING_STATUS: {
    PENDING: "pending",
    CONFIRMED: "confirmed",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
  },

  // Course Levels
  COURSE_LEVELS: {
    BEGINNER: "Beginner",
    INTERMEDIATE: "Intermediate",
    ADVANCED: "Advanced",
  },

  // Notification Categories
  NOTIFICATION_CATEGORIES: {
    APPLICATION: "application",
    STREAK: "streak",
    SYSTEM: "system",
    MENTORSHIP: "mentorship",
    DOUBT: "doubt",
    ROADMAP: "roadmap",
  },

  // Default Fallbacks
  DEFAULTS: {
    AVATAR: "/images/avatars/default.png",
    COURSE_THUMBNAIL: "/images/courses/default-thumbnail.jpg",
    COMPANY_LOGO: "/images/companies/default-logo.png",
    PASSING_SCORE: 60,
    MIN_SCORE_CUTOFF: 50,
    PAGINATION_LIMIT: 20,
  },
};