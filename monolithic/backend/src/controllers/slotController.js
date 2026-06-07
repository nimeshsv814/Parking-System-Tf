const Slot = require("../models/Slot");
const {
  buildVehiclePricing,
  ensureSlotPricing,
  getSlotSnapshot,
  occupySlot,
  releaseSlot,
  reserveSlot,
} = require("../services/slotService");

const listSlots = async (_req, res) => {
  const slots = await Slot.find().sort({ location: 1, slotId: 1 });
  return res.json(await Promise.all(slots.map(ensureSlotPricing)));
};

const listAvailableSlots = async (_req, res) => {
  const slots = await Slot.find({ status: "available" }).sort({ location: 1, slotId: 1 });
  return res.json(await Promise.all(slots.map(ensureSlotPricing)));
};

const createSlot = async (req, res) => {
  try {
    const { slotId, location, price, pricing, vehiclePricing } = req.body;
    const resolvedPricing = buildVehiclePricing({ price, vehiclePricing: pricing || vehiclePricing });
    if (!slotId || !location || !resolvedPricing) {
      return res.status(400).json({ message: "slotId, location, and pricing are required" });
    }

    const existing = await Slot.findOne({ slotId });
    if (existing) {
      return res.status(409).json({ message: "Slot already exists" });
    }

    const slot = await Slot.create({
      slotId,
      location,
      vehiclePricing: resolvedPricing,
      price: resolvedPricing.fourWheeler,
      status: "available",
    });

    return res.status(201).json({ message: "Slot created", slot: await ensureSlotPricing(slot) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create slot", error: error.message });
  }
};

const updateSlotStatus = async (req, res) => {
  try {
    const { slotId } = req.params;
    const { status } = req.body;
    const allowedStatuses = ["available", "reserved", "occupied", "blocked"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid slot status" });
    }

    const slot = await Slot.findOne({ slotId });
    if (!slot) {
      return res.status(404).json({ message: "Slot not found" });
    }

    slot.status = status;
    if (status === "available" || status === "blocked") {
      slot.bookingId = null;
    }

    await slot.save();
    return res.json({ message: "Slot status updated", slot: await ensureSlotPricing(slot) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update slot", error: error.message });
  }
};

const getSlotInternal = async (req, res) => {
  try {
    return res.json(await getSlotSnapshot(req.params.slotId));
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || "Failed to load slot" });
  }
};

const reserveSlotInternal = async (req, res) => {
  try {
    const slot = await reserveSlot({ slotId: req.params.slotId, bookingId: req.body.bookingId });
    return res.json({ message: "Slot reserved", slot });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || "Failed to reserve slot" });
  }
};

const releaseSlotInternal = async (req, res) => {
  try {
    const slot = await releaseSlot(req.params.slotId);
    return res.json({ message: "Slot released", slot });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || "Failed to release slot" });
  }
};

const occupySlotInternal = async (req, res) => {
  try {
    const slot = await occupySlot({ slotId: req.params.slotId, bookingId: req.body.bookingId });
    return res.json({ message: "Slot marked occupied", slot });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || "Failed to occupy slot" });
  }
};

module.exports = {
  createSlot,
  getSlotInternal,
  listAvailableSlots,
  listSlots,
  occupySlotInternal,
  releaseSlotInternal,
  reserveSlotInternal,
  updateSlotStatus,
};
