const cron = require("node-cron");
const { expirePendingBookings } = require("../services/bookingService");

const runExpiryScan = async () => {
  try {
    const expiredBookings = await expirePendingBookings();
    console.log("Scheduler expiry scan:", {
      expiredCount: expiredBookings.length,
      bookings: expiredBookings.map((booking) => booking.bookingId),
    });
  } catch (error) {
    console.error("Scheduler scan failed:", error.message);
  }
};

const startExpiryScheduler = () => {
  if (process.env.DISABLE_SCHEDULER === "true") {
    console.log("Booking expiry scheduler disabled");
    return null;
  }

  const schedule = process.env.CRON_SCHEDULE || "* * * * *";
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid CRON_SCHEDULE: ${schedule}`);
  }

  const task = cron.schedule(schedule, runExpiryScan);
  setTimeout(runExpiryScan, 5000);
  console.log(`Booking expiry scheduler started with schedule "${schedule}"`);
  return task;
};

module.exports = { runExpiryScan, startExpiryScheduler };
