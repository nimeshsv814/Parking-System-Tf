import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiError, parkingApi } from "../api/client";
import { Loader } from "../components/Loader";
import { SlotCard } from "../components/SlotCard";
import { useToast } from "../context/ToastContext";

export const SlotsPage = () => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingSlotId, setBookingSlotId] = useState("");
  const [filter, setFilter] = useState("all");
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const loadSlots = async () => {
    try {
      const response = await parkingApi.get("/slots");
      setSlots(response.data);
    } catch (error) {
      pushToast({ title: "Failed to load slots", description: getApiError(error), tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, []);

  const handleBook = (slot) => {
    setBookingSlotId(slot.slotId);
    navigate(`/payment?slotId=${encodeURIComponent(slot.slotId)}`, { state: { slot } });
  };

  const filteredSlots = filter === "all" ? slots : slots.filter((slot) => slot.status === filter);

  if (loading) {
    return <Loader label="Loading slot map..." />;
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="section-title">Parking slots</h2>
          <p className="muted-copy">Browse live slot statuses and book available spaces instantly.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "available", "reserved", "occupied", "blocked"].map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? "button-primary" : "button-secondary"}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredSlots.map((slot) => (
          <SlotCard
            key={slot.slotId}
            slot={slot}
            action={slot.status === "available" ? () => handleBook(slot) : null}
            actionLabel={bookingSlotId === slot.slotId ? "Opening checkout..." : "Book now"}
            disabled={bookingSlotId === slot.slotId}
            priceLabel={`2W Rs ${slot.pricing?.twoWheeler ?? "-"} / hr | 4W Rs ${slot.pricing?.fourWheeler ?? "-"} / hr`}
          />
        ))}
      </div>
    </div>
  );
};

