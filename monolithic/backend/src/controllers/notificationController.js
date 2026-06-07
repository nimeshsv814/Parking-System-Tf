const Notification = require("../models/Notification");
const { queueNotification } = require("../services/notificationService");

const createNotification = async (req, res) => {
  try {
    const notification = await queueNotification(req.body);
    return res.status(201).json({ message: "Notification queued", notification });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Failed to create notification",
    });
  }
};

const getNotifications = async (req, res) => {
  const query = req.user.role === "admin" ? {} : { recipientUserId: req.user.id };
  const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(100);
  return res.json(notifications);
};

module.exports = { createNotification, getNotifications };
