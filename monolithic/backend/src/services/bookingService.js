const Booking = require("../models/Booking");
const HttpError = require("../utils/HttpError");
const { occupySlot, releaseSlot } = require("./slotService");
const { queueNotification } = require("./notificationService");

const findBookingByBookingId = async (bookingId) => {
  const booking = await Booking.findOne({ bookingId });
  if (!booking) {
    throw new HttpError(404, "Booking not found");
  }
  return booking;
};

const assertBookingAccess = (booking, user) => {
  if (user.role !== "admin" && booking.userId !== user.id) {
    throw new HttpError(403, "Access denied for this booking");
  }
};

const buildBookingSummary = (booking) => ({
  bookingId: booking.bookingId,
  slotId: booking.slotId,
  vehicleType: booking.vehicleType,
  startTime: booking.startTime,
  endTime: booking.endTime,
  duration: booking.duration ?? booking.durationHours ?? null,
  durationHours: booking.durationHours ?? booking.duration ?? null,
  ratePerHour: booking.ratePerHour ?? null,
  totalAmount: booking.totalAmount ?? booking.amount,
});

const sendBookingNotification = async ({ booking, type, message, metadata = {} }) => {
  try {
    await queueNotification({
      recipientUserId: booking.userId,
      bookingId: booking.bookingId,
      type,
      message,
      channel: "console",
      metadata,
    });
  } catch (error) {
    console.error("Notification send failed", error.message);
  }
};

const confirmBookingById = async (bookingId) => {
  const booking = await findBookingByBookingId(bookingId);

  if (booking.status !== "pending") {
    throw new HttpError(400, `Cannot confirm a ${booking.status} booking`);
  }

  booking.status = "confirmed";
  booking.paidAt = new Date();
  await booking.save();
  await occupySlot({ slotId: booking.slotId, bookingId: booking.bookingId });
  await sendBookingNotification({
    booking,
    type: "booking_confirmed",
    message: `Booking ${booking.bookingId} has been confirmed.`,
    metadata: {
      slotId: booking.slotId,
      vehicleType: booking.vehicleType,
      ratePerHour: booking.ratePerHour,
      durationHours: booking.durationHours,
      amount: booking.totalAmount,
    },
  });

  return booking;
};

const cancelBookingById = async (
  bookingId,
  { notificationMessage = null, cancelledAt = new Date() } = {}
) => {
  const booking = await findBookingByBookingId(bookingId);

  if (!["pending", "confirmed"].includes(booking.status)) {
    throw new HttpError(400, `Cannot cancel a ${booking.status} booking`);
  }

  booking.status = "cancelled";
  booking.cancelledAt = cancelledAt;
  await booking.save();
  await releaseSlot(booking.slotId);
  await sendBookingNotification({
    booking,
    type: "booking_cancelled",
    message: notificationMessage || `Booking ${booking.bookingId} was cancelled.`,
    metadata: { slotId: booking.slotId },
  });

  return booking;
};

const expireBookingById = async (bookingId) => {
  const booking = await findBookingByBookingId(bookingId);

  if (booking.status !== "pending") {
    throw new HttpError(400, `Cannot expire a ${booking.status} booking`);
  }

  booking.status = "expired";
  booking.expiredAt = new Date();
  await booking.save();
  await releaseSlot(booking.slotId);
  await sendBookingNotification({
    booking,
    type: "booking_expired",
    message: `Booking ${booking.bookingId} expired because payment was not completed.`,
    metadata: { slotId: booking.slotId },
  });

  return booking;
};

const expirePendingBookings = async () => {
  const expiredBookings = await Booking.find({
    status: "pending",
    expiresAt: { $lte: new Date() },
  });

  for (const booking of expiredBookings) {
    booking.status = "expired";
    booking.expiredAt = new Date();
    await booking.save();
    await releaseSlot(booking.slotId);
    await sendBookingNotification({
      booking,
      type: "booking_expired",
      message: `Booking ${booking.bookingId} expired and slot ${booking.slotId} was released.`,
      metadata: { slotId: booking.slotId },
    });
  }

  return expiredBookings;
};

module.exports = {
  assertBookingAccess,
  buildBookingSummary,
  cancelBookingById,
  confirmBookingById,
  expireBookingById,
  expirePendingBookings,
  findBookingByBookingId,
  sendBookingNotification,
};
