const mongoose = require("mongoose");
const InterviewSession = require("../models/InterviewSession");
const policy = require("../config/interviewIntegrity");

const focusTypes = ["TAB_SWITCH", "PAGE_HIDDEN", "WINDOW_BLUR"];
const messages = {
  warning: (n, max) => n === max - 1
    ? `Final warning (${n} of ${max}). Please remain on the interview screen.`
    : `Warning ${n} of ${max}. Please remain on the interview screen.`,
  terminated: "Your interview has been terminated according to the integrity policy.",
};
const isId = (value) => mongoose.isValidObjectId(value);

function sanitizeDetails(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const clean = {};
  for (const [key, item] of Object.entries(value).slice(0, 20)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(key)) continue;
    if (["string", "boolean"].includes(typeof item)) clean[key] = typeof item === "string" ? item.slice(0, 200) : item;
    else if (typeof item === "number" && Number.isFinite(item)) clean[key] = item;
  }
  return Buffer.byteLength(JSON.stringify(clean), "utf8") <= policy.maxDetailsBytes ? clean : null;
}

function statusPayload(session) {
  const warningCount = session.warningCount || 0;
  const maxWarnings = session.maxWarnings || policy.maxWarnings;
  return { success: true, status: session.status, warningCount, maxWarnings, remainingWarnings: Math.max(0, maxWarnings - warningCount) };
}

exports.submitIntegrityEvent = async (req, res) => {
  const { interviewId } = req.params;
  const { eventId, type } = req.body || {};
  const details = sanitizeDetails(req.body?.details);
  if (!isId(interviewId)) return res.status(400).json({ success: false, error: "Invalid interview ID." });
  if (typeof eventId !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(eventId)) return res.status(400).json({ success: false, error: "A valid eventId is required." });
  if (!policy.enabledTypes.includes(type)) return res.status(400).json({ success: false, error: "This integrity event type is invalid or disabled." });
  if (!details) return res.status(400).json({ success: false, error: "Event details must be a small JSON object containing simple values." });

  const now = new Date();
  const focus = focusTypes.includes(type);
  const cooldown = focus ? policy.focusCooldownMs : policy.noiseCooldownMs;
  const lastField = focus ? "lastIntegrityFocusAt" : "lastIntegrityNoiseAt";
  const cutoff = new Date(now.getTime() - cooldown);
  const rateCutoff = new Date(now.getTime() - policy.rateWindowMs);
  const focusGuard = cooldown ? { $or: [{ [lastField]: null }, { [lastField]: { $lte: cutoff } }] } : {};
  const rateGuard = { $expr: { $lt: [
    { $size: { $filter: { input: { $ifNull: ["$integrityRequestTimes", []] }, as: "at", cond: { $gt: ["$$at", rateCutoff] } } } },
    policy.rateLimit,
  ] } };
  const match = { _id: interviewId, student: req.user._id, status: "active", "integrityEvents.eventId": { $ne: eventId }, ...focusGuard, ...rateGuard };
  const nextWarning = { $add: [{ $ifNull: ["$warningCount", 0] }, 1] };
  const terminated = { $gte: ["$warningCount", { $subtract: [{ $ifNull: ["$maxWarnings", policy.maxWarnings] }, 1] }] };
  const reason = type === "BACKGROUND_NOISE" ? "Repeated background noise events" : "Repeated interview focus-loss events";
  const event = {
    eventId, type, timestamp: now, details, reason,
    warningNumber: { $add: [{ $ifNull: ["$warningCount", 0] }, 1] },
    action: { $cond: [terminated, "terminated", "warning"] },
  };
  try {
    const session = await InterviewSession.findOneAndUpdate(match, [
      { $set: {
        maxWarnings: { $ifNull: ["$maxWarnings", policy.maxWarnings] },
        warningCount: nextWarning,
        [lastField]: now,
        integrityRequestTimes: { $slice: [{ $concatArrays: [
          { $filter: { input: { $ifNull: ["$integrityRequestTimes", []] }, as: "at", cond: { $gt: ["$$at", rateCutoff] } } }, [now],
        ] }, -policy.rateLimit] },
        integrityEvents: { $concatArrays: [{ $ifNull: ["$integrityEvents", []] }, [event]] },
        status: { $cond: [terminated, "terminated_integrity", "$status"] },
        terminationReason: { $cond: [terminated, reason, "$terminationReason"] },
        endedAt: { $cond: [terminated, now, "$endedAt"] },
      } },
    ], { new: true, updatePipeline: true });
    if (session) {
      const warningCount = session.warningCount || 0;
      const action = session.status === "terminated_integrity" ? "terminated" : "warning";
      return res.json({ success: true, warningCount, maxWarnings: session.maxWarnings, remainingWarnings: Math.max(0, session.maxWarnings - warningCount), status: session.status, action, message: action === "terminated" ? messages.terminated : messages.warning(warningCount, session.maxWarnings) });
    }

    const existing = await InterviewSession.findOne({ _id: interviewId, student: req.user._id });
    if (!existing) return res.status(404).json({ success: false, error: "Interview session not found." });
    if (existing.status !== "active") return res.status(409).json({ success: false, error: "Interview session is not active.", ...statusPayload(existing) });
    if (existing.integrityEvents?.some((item) => item.eventId === eventId)) return res.json({ ...statusPayload(existing), action: "ignored", message: "Duplicate event was ignored." });
    const coolingDown = cooldown && existing[lastField] && existing[lastField] > cutoff;
    const ignoredReason = coolingDown ? "Related focus events are within the configured cooldown." : "Integrity event rate limit exceeded.";
    await InterviewSession.updateOne(
      { _id: interviewId, student: req.user._id, status: "active", "integrityEvents.eventId": { $ne: eventId } },
      { $push: { integrityEvents: { eventId, type, timestamp: now, details, reason: ignoredReason, warningNumber: null, action: "ignored" } } }
    );
    const latest = await InterviewSession.findOne({ _id: interviewId, student: req.user._id });
    if (latest?.integrityEvents?.some((item) => item.eventId === eventId && item.action === "warning")) return res.json({ ...statusPayload(latest), action: "warning", message: messages.warning(latest.warningCount, latest.maxWarnings || policy.maxWarnings) });
    if (coolingDown) return res.json({ ...statusPayload(latest || existing), action: "ignored", message: "Event ignored during the configured cooldown." });
    return res.status(429).json({ success: false, ...statusPayload(latest || existing), action: "ignored", error: "Integrity event rate limit exceeded." });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Could not record integrity event." });
  }
};

exports.getIntegrityStatus = async (req, res) => {
  if (!isId(req.params.interviewId)) return res.status(400).json({ success: false, error: "Invalid interview ID." });
  const session = await InterviewSession.findOne({ _id: req.params.interviewId, student: req.user._id }).select("status maxWarnings warningCount");
  if (!session) return res.status(404).json({ success: false, error: "Interview session not found." });
  return res.json(statusPayload(session));
};

exports.getAdminIntegrityEvents = async (req, res) => {
  if (!isId(req.params.interviewId)) return res.status(400).json({ success: false, error: "Invalid interview ID." });
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 25));
  const session = await InterviewSession.findById(req.params.interviewId)
    .select("status maxWarnings warningCount terminationReason endedAt integrityEvents student")
    .lean();
  if (!session) return res.status(404).json({ success: false, error: "Interview session not found." });
  const events = (session.integrityEvents || []).slice().reverse();
  return res.json({ success: true, interviewId: String(session._id), studentId: String(session.student), status: session.status, warningCount: session.warningCount || 0, maxWarnings: session.maxWarnings || policy.maxWarnings, terminationReason: session.terminationReason || null, endedAt: session.endedAt || null, page, limit, total: events.length, events: events.slice((page - 1) * limit, page * limit) });
};
