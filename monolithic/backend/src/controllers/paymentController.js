const crypto = require("crypto");
const Razorpay = require("razorpay");
const Payment = require("../models/Payment");
const {
  assertBookingAccess,
  buildBookingSummary,
  cancelBookingById,
  confirmBookingById,
  findBookingByBookingId,
} = require("../services/bookingService");
const { queueNotification } = require("../services/notificationService");

const buildPaymentId = () => `PAY-${Date.now()}${Math.floor(Math.random() * 1000)}`;
const buildTransactionRef = () => `TXN-${Date.now()}${Math.floor(Math.random() * 10000)}`;
const getTrimmedEnv = (name) => (process.env[name] || "").trim();
const normalizeAmount = (value) => Number(Number(value || 0).toFixed(2));

const getRazorpayClient = () =>
  new Razorpay({
    key_id: getTrimmedEnv("RAZORPAY_KEY_ID"),
    key_secret: getTrimmedEnv("RAZORPAY_KEY_SECRET"),
  });

const getBookingForPayment = async ({ bookingId, user }) => {
  const booking = await findBookingByBookingId(bookingId);
  assertBookingAccess(booking, user);
  return booking;
};

const sendNotification = async ({ recipientUserId, bookingId, type, message, metadata = {} }) => {
  try {
    await queueNotification({
      recipientUserId,
      bookingId,
      type,
      message,
      channel: "console",
      metadata,
    });
  } catch (error) {
    console.error("Payment notification failed", error.message);
  }
};

const sendPaymentNotification = async ({ booking, payment, type, message }) => {
  const summary = buildBookingSummary(booking);
  await sendNotification({
    recipientUserId: booking.userId,
    bookingId: booking.bookingId,
    type,
    message,
    metadata: {
      ...summary,
      method: payment.method,
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      razorpayPaymentId: payment.razorpayPaymentId,
    },
  });
};

const finalizeConfirmedBooking = async (bookingId, booking) => {
  if (booking.status !== "pending") {
    return booking;
  }

  return confirmBookingById(bookingId);
};

const cancelBookingAndReleaseSlot = async (bookingId) => {
  try {
    return await cancelBookingById(bookingId, {
      notificationMessage: `Booking ${bookingId} was cancelled after payment failure.`,
    });
  } catch (error) {
    if (error.status === 400 && /Cannot cancel a cancelled booking/i.test(error.message || "")) {
      return findBookingByBookingId(bookingId);
    }
    throw error;
  }
};

const markPaymentFailed = async ({ booking, orderId = null, errorMessage = "Payment failed", paymentId = null }) => {
  let payment = null;

  if (paymentId) {
    payment = await Payment.findOne({ paymentId });
  }

  if (!payment && orderId) {
    payment = await Payment.findOne({ bookingId: booking.bookingId, orderId }).sort({ createdAt: -1 });
  }

  if (payment?.status === "success" || booking.status === "confirmed") {
    return { payment, booking, skipped: true };
  }

  if (booking.status !== "pending") {
    return { payment, booking, skipped: true };
  }

  if (!payment) {
    payment = new Payment({
      paymentId: buildPaymentId(),
      bookingId: booking.bookingId,
      userId: booking.userId,
      vehicleType: booking.vehicleType || null,
      durationHours: booking.durationHours ?? booking.duration ?? null,
      amount: booking.totalAmount ?? booking.amount,
      currency: "INR",
      method: "razorpay",
      status: "failed",
      orderId,
      transactionRef: orderId || buildTransactionRef(),
    });
  } else {
    payment.status = "failed";
    payment.method = "razorpay";
    payment.transactionRef = payment.transactionRef || orderId || buildTransactionRef();
  }

  await payment.save();
  const cancelledBooking = await cancelBookingAndReleaseSlot(booking.bookingId);
  await sendPaymentNotification({
    booking,
    payment,
    type: "payment_failed",
    message: `${errorMessage} for booking ${booking.bookingId}.`,
  });

  return { payment, booking: cancelledBooking, skipped: false };
};

const createOrder = async (req, res) => {
  try {
    const { bookingId, amount } = req.body;
    if (!bookingId) {
      return res.status(400).json({ message: "bookingId is required" });
    }

    const razorpayKeyId = getTrimmedEnv("RAZORPAY_KEY_ID");
    const razorpayKeySecret = getTrimmedEnv("RAZORPAY_KEY_SECRET");

    if (!razorpayKeyId || !razorpayKeySecret) {
      return res.status(500).json({ message: "Razorpay credentials are not configured" });
    }

    const booking = await getBookingForPayment({ bookingId, user: req.user });
    if (booking.status !== "pending") {
      return res.status(400).json({ message: `Cannot pay for a ${booking.status} booking` });
    }

    const summary = buildBookingSummary(booking);
    const expectedAmount = normalizeAmount(summary.totalAmount);
    if (Number.isNaN(expectedAmount) || expectedAmount <= 0) {
      return res.status(400).json({ message: "Invalid booking amount" });
    }

    if (amount !== undefined && normalizeAmount(amount) !== expectedAmount) {
      return res.status(400).json({ message: "Amount mismatch for this booking" });
    }

    const order = await getRazorpayClient().orders.create({
      amount: Math.round(expectedAmount * 100),
      currency: "INR",
      receipt: booking.bookingId,
      notes: {
        bookingId: booking.bookingId,
        userId: booking.userId,
      },
    });

    await Payment.create({
      paymentId: buildPaymentId(),
      bookingId,
      userId: booking.userId,
      vehicleType: booking.vehicleType || null,
      durationHours: booking.durationHours ?? booking.duration ?? null,
      amount: expectedAmount,
      currency: order.currency,
      method: "razorpay",
      status: "pending",
      orderId: order.id,
      transactionRef: order.id,
    });

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayKeyId,
      bookingId,
      summary,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Failed to create Razorpay order",
      error: error.status ? undefined : error.message,
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
      return res.status(400).json({
        message: "bookingId, razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
      });
    }

    const booking = await getBookingForPayment({ bookingId, user: req.user });

    let payment = await Payment.findOne({ bookingId, orderId: razorpay_order_id }).sort({ createdAt: -1 });
    if (payment?.status === "success") {
      const confirmedBooking = await finalizeConfirmedBooking(bookingId, booking);
      return res.json({
        message: "Payment already verified",
        payment,
        booking: confirmedBooking,
        summary: buildBookingSummary(confirmedBooking),
      });
    }

    const razorpayKeySecret = getTrimmedEnv("RAZORPAY_KEY_SECRET");
    if (!razorpayKeySecret) {
      return res.status(500).json({ message: "Razorpay credentials are not configured" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      const failedResult = await markPaymentFailed({
        booking,
        orderId: razorpay_order_id,
        errorMessage: "Payment verification failed",
      });
      return res.status(400).json({
        message: "Invalid payment signature",
        payment: failedResult.payment,
        booking: failedResult.booking,
      });
    }

    if (!payment) {
      payment = new Payment({
        paymentId: buildPaymentId(),
        bookingId,
        userId: booking.userId,
        vehicleType: booking.vehicleType || null,
        durationHours: booking.durationHours ?? booking.duration ?? null,
        amount: booking.totalAmount ?? booking.amount,
        currency: "INR",
        method: "razorpay",
        status: "pending",
        orderId: razorpay_order_id,
        transactionRef: razorpay_order_id,
      });
    }

    payment.status = "success";
    payment.method = "razorpay";
    payment.currency = payment.currency || "INR";
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.transactionRef = razorpay_payment_id;
    await payment.save();

    const confirmedBooking = await finalizeConfirmedBooking(bookingId, booking);

    await sendPaymentNotification({
      booking: confirmedBooking,
      payment,
      type: "payment_success",
      message: `Payment successful for booking ${bookingId}.`,
    });

    return res.json({
      message: "Payment verified successfully",
      payment,
      booking: confirmedBooking,
      summary: buildBookingSummary(confirmedBooking),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Payment verification failed",
      error: error.status ? undefined : error.message,
    });
  }
};

const failPayment = async (req, res) => {
  try {
    const { bookingId, razorpay_order_id, reason = "Payment cancelled" } = req.body;
    if (!bookingId) {
      return res.status(400).json({ message: "bookingId is required" });
    }

    const booking = await getBookingForPayment({ bookingId, user: req.user });

    const failedResult = await markPaymentFailed({
      booking,
      orderId: razorpay_order_id || null,
      errorMessage: reason,
    });

    return res.json({
      message: failedResult.skipped ? "Payment state already finalized" : "Payment failed",
      payment: failedResult.payment,
      booking: failedResult.booking,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Failed to mark payment as failed",
      error: error.status ? undefined : error.message,
    });
  }
};

const processPayment = async (req, res) => {
  try {
    const { bookingId, method = "card", simulateSuccess = true } = req.body;
    if (!bookingId) {
      return res.status(400).json({ message: "bookingId is required" });
    }

    const booking = await getBookingForPayment({ bookingId, user: req.user });

    if (booking.status !== "pending") {
      return res.status(400).json({ message: `Cannot pay for a ${booking.status} booking` });
    }

    const summary = buildBookingSummary(booking);

    const payment = await Payment.create({
      paymentId: buildPaymentId(),
      bookingId,
      userId: booking.userId,
      vehicleType: booking.vehicleType || null,
      durationHours: booking.durationHours ?? booking.duration ?? null,
      amount: summary.totalAmount,
      method,
      status: simulateSuccess ? "success" : "failed",
      transactionRef: buildTransactionRef(),
    });

    if (simulateSuccess) {
      const confirmedBooking = await confirmBookingById(bookingId);
      await sendNotification({
        recipientUserId: booking.userId,
        bookingId,
        type: "payment_success",
        message: `Payment successful for booking ${bookingId}.`,
        metadata: { ...summary, method, paymentId: payment.paymentId },
      });
      return res.json({
        message: "Payment successful",
        summary,
        payment,
        booking: confirmedBooking,
      });
    }

    const cancelledBooking = await cancelBookingById(bookingId, {
      notificationMessage: `Booking ${bookingId} was cancelled after payment failure.`,
    });
    await sendNotification({
      recipientUserId: booking.userId,
      bookingId,
      type: "payment_failed",
      message: `Payment failed for booking ${bookingId}.`,
      metadata: { ...summary, method, paymentId: payment.paymentId },
    });

    return res.status(400).json({
      message: "Payment failed",
      summary,
      payment,
      booking: cancelledBooking,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Payment processing failed",
      error: error.status ? undefined : error.message,
    });
  }
};

const getPayments = async (req, res) => {
  const query = req.user.role === "admin" ? {} : { userId: req.user.id };
  const payments = await Payment.find(query).sort({ createdAt: -1 });
  return res.json(payments);
};

module.exports = { createOrder, failPayment, getPayments, processPayment, verifyPayment };
