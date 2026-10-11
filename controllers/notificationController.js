const Notification = require("../models/Notification");

exports.getNotifications = async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 });
  const unreadCount = notifications.reduce((count, notification) => count + (notification.isRead ? 0 : 1), 0);
  res.render("student/notifications", { title: "Notifications", notifications, unreadCount });
};

exports.getPreview = async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(5).lean(),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
  ]);
  res.json({ success: true, notifications, unreadCount });
};

exports.markAsRead = async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true },
    { new: true }
  );
  if (!notification) return res.status(404).json({ success: false, error: "Notification not found." });
  res.json({ success: true });
};

exports.markAllAsRead = async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { $set: { isRead: true } }
  );
  res.json({ success: true, updatedCount: result.modifiedCount || 0 });
};
