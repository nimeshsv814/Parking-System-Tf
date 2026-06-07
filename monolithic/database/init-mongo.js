db = db.getSiblingDB("smartparking");

const collections = ["users", "slots", "bookings", "payments", "notifications"];

collections.forEach((collectionName) => {
  if (!db.getCollectionNames().includes(collectionName)) {
    db.createCollection(collectionName);
  }
});

db.users.createIndex({ email: 1 }, { unique: true });
db.slots.createIndex({ slotId: 1 }, { unique: true });
db.bookings.createIndex({ bookingId: 1 }, { unique: true });
db.payments.createIndex({ paymentId: 1 }, { unique: true });

print("smartparking database initialized");
