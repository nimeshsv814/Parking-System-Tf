const mongoose = require("mongoose");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDB = async (mongoUri) => {
  if (!mongoUri) {
    throw new Error("MONGO_URI is required");
  }

  const maxAttempts = Number(process.env.MONGO_CONNECT_RETRIES || 10);
  const retryDelayMs = Number(process.env.MONGO_CONNECT_RETRY_DELAY_MS || 3000);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await mongoose.connect(mongoUri);
      console.log("Monolithic backend connected to MongoDB");
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      console.log(`MongoDB connection attempt ${attempt}/${maxAttempts} failed; retrying...`);
      await wait(retryDelayMs);
    }
  }
};

module.exports = { connectDB };
