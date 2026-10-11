/**
 * Normalizes a given date to the start of the day (00:00:00.000).
 *
 * @param {Date|string|number} [date=new Date()]
 * @returns {Date}
 */
const getStartOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Normalizes a given date to the end of the day (23:59:59.999).
 *
 * @param {Date|string|number} [date=new Date()]
 * @returns {Date}
 */
const getEndOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getDateKeyIST = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(date));
  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${value.year}-${value.month}-${value.day}`;
};

const getDayBoundsIST = (date = new Date()) => {
  const [year, month, day] = getDateKeyIST(date).split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - (5 * 60 + 30) * 60 * 1000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

/**
 * Checks if a specific date corresponds to yesterday relative to today.
 *
 * @param {Date|string|number} targetDate
 * @returns {boolean}
 */
const isYesterday = (targetDate) => {
  const today = getStartOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const check = getStartOfDay(targetDate);
  return check.getTime() === yesterday.getTime();
};

/**
 * Evaluates whether student activity continues their active streak or resets it.
 *
 * @param {Date} lastActivityDate - Last recorded active date
 * @param {number} currentStreak - Current streak counter
 * @returns {number} Updated streak number
 */
const evaluateStreak = (lastActivityDate, currentStreak = 0) => {
  if (!lastActivityDate) return 1;

  const today = getDayBoundsIST().start;
  const lastActive = getDayBoundsIST(lastActivityDate).start;
  const diffDays = (today.getTime() - lastActive.getTime()) / (24 * 60 * 60 * 1000);

  if (diffDays === 0) {
    // Already active today; retain existing streak
    return currentStreak;
  } else if (diffDays === 1) {
    // Activity yesterday; increment streak by 1
    return currentStreak + 1;
  } else {
    // Missed one or more days; reset streak
    return 1;
  }
};

/**
 * Formats a Date object into human-readable IST string.
 *
 * @param {Date} date
 * @returns {string} E.g., "10 Oct 2026, 08:30 PM"
 */
const formatDateTimeIST = (date) => {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
};

module.exports = {
  getStartOfDay,
  getEndOfDay,
  getDateKeyIST,
  getDayBoundsIST,
  isYesterday,
  evaluateStreak,
  formatDateTimeIST,
};
