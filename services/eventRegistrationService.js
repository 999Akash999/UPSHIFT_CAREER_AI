const AlumniEvent = require("../models/AlumniEvent");
const EventRegistration = require("../models/EventRegistration");

const syncRegistrationCounts = async () => {
  const events = await AlumniEvent.find({ registrationCount: { $exists: false } }).select("_id").lean();
  if (!events.length) return;
  const eventIds = events.map((event) => event._id);
  const groups = await EventRegistration.aggregate([
    { $match: { event: { $in: eventIds } } },
    { $group: { _id: "$event", registrationCount: { $sum: 1 } } },
  ]);
  const counts = new Map(groups.map((group) => [String(group._id), group.registrationCount]));

  await AlumniEvent.bulkWrite(events.map((event) => ({
    updateOne: {
      filter: { _id: event._id },
      update: { $set: { registrationCount: counts.get(String(event._id)) || 0 } },
    },
  })));
};

module.exports = { syncRegistrationCounts };
