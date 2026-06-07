const Slot = require("../models/Slot");
const HttpError = require("../utils/HttpError");

const buildVehiclePricing = ({ price, vehiclePricing }) => {
  if (
    vehiclePricing &&
    typeof vehiclePricing.twoWheeler === "number" &&
    typeof vehiclePricing.fourWheeler === "number"
  ) {
    return vehiclePricing;
  }

  if (typeof price === "number") {
    return {
      twoWheeler: Number((price / 2).toFixed(2)),
      fourWheeler: price,
    };
  }

  return null;
};

const ensureSlotPricing = async (slot) => {
  const pricing = buildVehiclePricing({ price: slot.price, vehiclePricing: slot.vehiclePricing });
  if (
    pricing &&
    (!slot.vehiclePricing ||
      slot.vehiclePricing.twoWheeler !== pricing.twoWheeler ||
      slot.vehiclePricing.fourWheeler !== pricing.fourWheeler)
  ) {
    slot.vehiclePricing = pricing;
    await slot.save();
  }

  return {
    ...slot.toObject(),
    pricing,
  };
};

const findSlotBySlotId = async (slotId) => {
  const slot = await Slot.findOne({ slotId });
  if (!slot) {
    throw new HttpError(404, "Slot not found");
  }
  return slot;
};

const getSlotSnapshot = async (slotId) => ensureSlotPricing(await findSlotBySlotId(slotId));

const reserveSlot = async ({ slotId, bookingId }) => {
  const slot = await findSlotBySlotId(slotId);

  if (slot.status !== "available") {
    throw new HttpError(409, "Slot is not available");
  }

  slot.status = "reserved";
  slot.bookingId = bookingId || null;
  await slot.save();
  return ensureSlotPricing(slot);
};

const releaseSlot = async (slotId) => {
  const slot = await findSlotBySlotId(slotId);

  if (slot.status !== "blocked") {
    slot.status = "available";
    slot.bookingId = null;
    await slot.save();
  }

  return ensureSlotPricing(slot);
};

const occupySlot = async ({ slotId, bookingId }) => {
  const slot = await findSlotBySlotId(slotId);

  slot.status = "occupied";
  if (bookingId) {
    slot.bookingId = bookingId;
  }
  await slot.save();
  return ensureSlotPricing(slot);
};

module.exports = {
  buildVehiclePricing,
  ensureSlotPricing,
  findSlotBySlotId,
  getSlotSnapshot,
  occupySlot,
  releaseSlot,
  reserveSlot,
};
