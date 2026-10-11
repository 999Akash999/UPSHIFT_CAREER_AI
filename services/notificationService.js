const Notification = require("../models/Notification");
const { getIO } = require("../config/socket");

const sendNotification = async ({ recipientId, senderId = null, title, message, category = "system", actionUrl = "/student/dashboard" }) => {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      title,
      message,
      category,
      actionUrl,
    });

    try {
      const io = getIO();
      io.to(`user:${recipientId}`).emit("new:notification", notification);
    } catch {
      // Socket might not be active in worker contexts; silently ignore
    }

    return notification;
  } catch (err) {
    console.error("Failed to dispatch notification:", err.message);
  }
};

module.exports = { sendNotification };