require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { connectDB } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const slotRoutes = require("./routes/slotRoutes");
const { ensureSeedSlots, ensureSeedUsers } = require("./scripts/seed");
const { startExpiryScheduler } = require("./scheduler/expiryScheduler");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({
    service: "smart-parking-monolith",
    status: "ok",
    tiers: ["frontend", "backend", "database"],
    mountedServices: ["auth", "parking", "booking", "payment", "notification", "scheduler"],
  });
});

app.use("/auth", authRoutes);
app.use("/parking", slotRoutes);
app.use("/booking", bookingRoutes);
app.use("/payment", paymentRoutes);
app.use("/notification", notificationRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    await ensureSeedUsers();
    await ensureSeedSlots();
    startExpiryScheduler();

    const port = process.env.PORT || 4000;
    app.listen(port, () => {
      console.log(`Smart Parking monolithic backend listening on port ${port}`);
    });
  } catch (error) {
    console.error("Monolithic backend failed to start", error);
    process.exit(1);
  }
};

start();
