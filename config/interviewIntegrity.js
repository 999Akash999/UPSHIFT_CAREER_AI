const integer = (name, fallback, { min = 0, max = 100000 } = {}) => {
  const raw = process.env[name];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
};

const eventTypes = (process.env.INTERVIEW_INTEGRITY_EVENT_TYPES || "TAB_SWITCH,PAGE_HIDDEN,WINDOW_BLUR,BACKGROUND_NOISE")
  .split(",").map((type) => type.trim()).filter(Boolean);
const supportedTypes = new Set(["TAB_SWITCH", "PAGE_HIDDEN", "WINDOW_BLUR", "BACKGROUND_NOISE"]);
if (!eventTypes.length || eventTypes.some((type) => !supportedTypes.has(type))) {
  throw new Error("INTERVIEW_INTEGRITY_EVENT_TYPES contains an unsupported event type.");
}

module.exports = Object.freeze({
  maxWarnings: integer("INTERVIEW_MAX_WARNINGS", 3, { min: 1, max: 20 }),
  focusCooldownMs: integer("INTERVIEW_TAB_SWITCH_COOLDOWN_MS", 15000, { min: 0, max: 3600000 }),
  noiseCooldownMs: integer("INTERVIEW_BACKGROUND_NOISE_COOLDOWN_MS", 30000, { min: 0, max: 3600000 }),
  rateWindowMs: integer("INTERVIEW_EVENT_RATE_WINDOW_MS", 60000, { min: 1000, max: 3600000 }),
  rateLimit: integer("INTERVIEW_EVENT_RATE_LIMIT", 20, { min: 1, max: 1000 }),
  enabledTypes: eventTypes,
  maxDetailsBytes: 1024,
});
