const AlumniEvent = require("../models/AlumniEvent");
const EventRegistration = require("../models/EventRegistration");

exports.registerForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await AlumniEvent.findById(eventId);
    if (!event || event.scheduledAt < new Date()) {
      req.flash("error", "This event is unavailable.");
      return res.redirect("/student/events");
    }
    const alreadyRegistered = await EventRegistration.exists({ user: req.user._id, event: eventId });
    if (alreadyRegistered) {
      req.flash("info", "You are already registered for this event.");
      return res.redirect("/student/events");
    }
    const reservedEvent = await AlumniEvent.findOneAndUpdate(
      {
        _id: eventId,
        scheduledAt: { $gt: new Date() },
        $expr: { $lt: [{ $ifNull: ["$registrationCount", 0] }, "$capacity"] },
      },
      { $inc: { registrationCount: 1 } },
      { new: true }
    );
    if (!reservedEvent) {
      req.flash("error", "This event is full.");
      return res.redirect("/student/events");
    }
    try {
      await EventRegistration.create({ user: req.user._id, event: eventId });
    } catch (registrationError) {
      await AlumniEvent.updateOne({ _id: eventId, registrationCount: { $gt: 0 } }, { $inc: { registrationCount: -1 } });
      if (registrationError.code === 11000) {
        req.flash("info", "You are already registered for this event.");
        return res.redirect("/student/events");
      }
      throw registrationError;
    }
    req.flash("success", "Seat reserved successfully!");
    res.redirect("/student/events");
  } catch (err) {
    req.flash("error", "Registration error or seat full.");
    res.redirect("/student/events");
  }
};
