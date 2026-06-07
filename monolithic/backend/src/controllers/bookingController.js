const Booking = require("../models/Booking");
const {
  cancelBookingById,
  confirmBookingById,
  expireBookingById,
  expirePendingBookings: expirePendingBookingsService,
  findBookingByBookingId,
  sendBookingNotification,
} = require("../services/bookingService");
const { getSlotSnapshot, reserveSlot } = require("../services/slotService");

const buildBookingId = () => `BKG-${Date.now()}${Math.floor(Math.random() * 1000)}`;

const getSlotRatePerHour = ({ slot, vehicleType }) => {
  if (!vehicleType) {
    return null;
  }

  const slotPricing = slot.pricing || slot.vehiclePricing;
  if (!slotPricing) {
    return null;
  }

  if (vehicleType === "2-wheeler") {
    return slotPricing.twoWheeler ?? null;
  }

  if (vehicleType === "4-wheeler") {
    return slotPricing.fourWheeler ?? null;
  }

  return null;
};

const parseBookingWindow = ({ startTime, endTime, duration }) => {
  if (!startTime && !endTime && (duration === undefined || duration === null || duration === "")) {
    return null;
  }

  const parsedStart = new Date(startTime);
  if (Number.isNaN(parsedStart.getTime())) {
    return { error: "A valid startTime is required" };
  }

  let durationHours = duration !== undefined && duration !== null && duration !== "" ? Number(duration) : null;
  const parsedEnd = endTime ? new Date(endTime) : null;

  if (parsedEnd && Number.isNaN(parsedEnd.getTime())) {
    return { error: "endTime must be a valid date" };
  }

  if (!parsedEnd && (durationHours === null || Number.isNaN(durationHours))) {
    return { error: "Provide either a valid endTime or duration" };
  }

  if (parsedEnd && durationHours === null) {
    durationHours = Number(((parsedEnd.getTime() - parsedStart.getTime()) / (60 * 60 * 1000)).toFixed(2));
  }

  if (durationHours === null || Number.isNaN(durationHours) || durationHours <= 0) {
    return { error: "duration must be a positive number of hours" };
  }

  const resolvedEnd =
    parsedEnd || new Date(parsedStart.getTime() + Math.round(durationHours * 60 * 60 * 1000));

  if (resolvedEnd <= parsedStart) {
    return { error: "endTime must be after startTime" };
  }

  if (parsedEnd) {
    const derivedDuration = Number(((resolvedEnd.getTime() - parsedStart.getTime()) / (60 * 60 * 1000)).toFixed(2));
    if (Math.abs(derivedDuration - durationHours) > 0.01) {
      return { error: "endTime and duration do not match" };
    }
    durationHours = derivedDuration;
  }

  return {
    startTime: parsedStart,
    endTime: resolvedEnd,
    durationHours,
  };
};

const buildBookingResponse = (booking) => ({
  message: "Booking created",
  booking,
  bookingId: booking.bookingId,
  totalAmount: booking.totalAmount,
  status: booking.status,
});

const createBooking = async (req, res) => {
  let booking = null;

  try {
    const { slotId, vehicleType, startTime, endTime, duration, durationHours } = req.body;
    if (!slotId) {
      return res.status(400).json({ message: "slotId is required" });
    }

    const slot = await getSlotSnapshot(slotId);
    if (slot.status !== "available") {
      return res.status(409).json({ message: "Selected slot is not available" });
    }

    const requestedDuration = durationHours ?? duration;
    const bookingWindow = parseBookingWindow({
      startTime,
      endTime,
      duration: requestedDuration,
    });

    if (bookingWindow?.error) {
      return res.status(400).json({ message: bookingWindow.error });
    }

    if (vehicleType && !bookingWindow) {
      return res.status(400).json({ message: "Provide startTime and endTime or duration with vehicleType" });
    }

    const shouldUseDynamicPricing = Boolean(vehicleType || bookingWindow);
    const ratePerHour = shouldUseDynamicPricing ? getSlotRatePerHour({ slot, vehicleType }) : null;
    if (shouldUseDynamicPricing && typeof ratePerHour !== "number") {
      return res.status(400).json({ message: "vehicleType must be either 2-wheeler or 4-wheeler" });
    }

    if (bookingWindow) {
      const overlappingBooking = await Booking.findOne({
        slotId,
        status: { $in: ["pending", "confirmed"] },
        startTime: { $lt: bookingWindow.endTime },
        endTime: { $gt: bookingWindow.startTime },
      });

      if (overlappingBooking) {
        return res.status(409).json({
          message: "Selected slot is not available for the full requested duration",
        });
      }
    }

    const totalAmount = shouldUseDynamicPricing
      ? Number((ratePerHour * bookingWindow.durationHours).toFixed(2))
      : slot.price;

    booking = await Booking.create({
      bookingId: buildBookingId(),
      userId: req.user.id,
      userEmail: req.user.email,
      slotId,
      vehicleType: shouldUseDynamicPricing ? vehicleType : null,
      startTime: bookingWindow?.startTime || null,
      endTime: bookingWindow?.endTime || null,
      duration: bookingWindow?.durationHours ?? null,
      durationHours: bookingWindow?.durationHours ?? null,
      ratePerHour,
      amount: totalAmount,
      totalAmount,
      status: "pending",
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + Number(process.env.BOOKING_HOLD_MINUTES || 10) * 60 * 1000),
    });

    try {
      await reserveSlot({ slotId, bookingId: booking.bookingId });
    } catch (error) {
      await Booking.deleteOne({ _id: booking._id });
      return res.status(error.status || 500).json({
        message: error.message || "Failed to reserve slot",
      });
    }

    await sendBookingNotification({
      booking,
      type: "booking_pending",
      message: `Booking ${booking.bookingId} created for slot ${slotId}. Complete payment before expiration.`,
      metadata: {
        slotId,
        vehicleType: booking.vehicleType,
        startTime: booking.startTime,
        endTime: booking.endTime,
        ratePerHour: booking.ratePerHour,
        durationHours: booking.durationHours,
        amount: booking.totalAmount,
      },
    });

    return res.status(201).json(buildBookingResponse(booking));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Failed to create booking",
      error: error.status ? undefined : error.message,
    });
  }
};

const getBookings = async (req, res) => {
  const query = req.user.role === "admin" ? {} : { userId: req.user.id };
  const bookings = await Booking.find(query).sort({ createdAt: -1 });
  return res.json(bookings);
};

const getBookingById = async (req, res) => {
  try {
    const booking = await findBookingByBookingId(req.params.bookingId);
    if (req.user.role !== "admin" && booking.userId !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    return res.json(booking);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || "Failed to load booking" });
  }
};

const cancelBooking = async (req, res) => {
  try {
    const booking = await findBookingByBookingId(req.params.bookingId);
    if (req.user.role !== "admin" && booking.userId !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const cancelledBooking = await cancelBookingById(req.params.bookingId);
    return res.json({ message: "Booking cancelled", booking: cancelledBooking });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Failed to cancel booking",
      error: error.status ? undefined : error.message,
    });
  }
};

const getBookingInternal = async (req, res) => {
  try {
    return res.json(await findBookingByBookingId(req.params.bookingId));
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || "Failed to load booking" });
  }
};

const confirmBookingInternal = async (req, res) => {
  try {
    const booking = await confirmBookingById(req.params.bookingId);
    return res.json({ message: "Booking confirmed", booking });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Failed to confirm booking",
      error: error.status ? undefined : error.message,
    });
  }
};

const cancelBookingInternal = async (req, res) => {
  try {
    const booking = await cancelBookingById(req.params.bookingId, {
      notificationMessage: `Booking ${req.params.bookingId} was cancelled after payment failure.`,
    });
    return res.json({ message: "Booking cancelled", booking });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Failed to cancel booking",
      error: error.status ? undefined : error.message,
    });
  }
};

const expireBookingInternal = async (req, res) => {
  try {
    const booking = await expireBookingById(req.params.bookingId);
    return res.json({ message: "Booking expired", booking });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Failed to expire booking",
      error: error.status ? undefined : error.message,
    });
  }
};

const expirePendingBookings = async (_req, res) => {
  try {
    const expiredBookings = await expirePendingBookingsService();
    return res.json({
      message: "Expired booking scan completed",
      expiredCount: expiredBookings.length,
      bookings: expiredBookings.map((booking) => booking.bookingId),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to expire pending bookings", error: error.message });
  }
};

module.exports = {
  cancelBooking,
  cancelBookingInternal,
  confirmBookingInternal,
  createBooking,
  expireBookingInternal,
  expirePendingBookings,
  getBookingById,
  getBookingInternal,
  getBookings,
};
