const Notification = require("../models/Notification");
const HttpError = require("../utils/HttpError");

const queueNotification = async ({
  recipientUserId,
  bookingId = null,
  type,
  channel = "console",
  message,
  metadata = {},
}) => {
  if (!recipientUserId || !type || !message) {
    throw new HttpError(400, "recipientUserId, type, and message are required");
  }

  const notification = await Notification.create({
    recipientUserId,
    bookingId,
    type,
    channel,
    message,
    metadata,
  });

  console.log(`[Notification:${channel}] user=${recipientUserId} type=${type} message=${message}`);
  return notification;
};

module.exports = { queueNotification };
