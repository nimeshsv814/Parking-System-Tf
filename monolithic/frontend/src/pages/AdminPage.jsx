import { useEffect, useState } from "react";
import { bookingApi, getApiError, parkingApi } from "../api/client";
import { Loader } from "../components/Loader";
import { useToast } from "../context/ToastContext";

const emptySlotForm = {
  slotId: "",
  location: "",
  price: 0,
};

const statusOptions = ["available", "reserved", "occupied", "blocked"];

export const AdminPage = () => {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [slotForm, setSlotForm] = useState(emptySlotForm);
  const [submitting, setSubmitting] = useState(false);
  const [updatingSlotId, setUpdatingSlotId] = useState("");
  const { pushToast } = useToast();

  const loadAdminData = async () => {
    try {
      const [slotsResponse, bookingsResponse] = await Promise.all([
        parkingApi.get("/slots"),
        bookingApi.get("/bookings"),
      ]);
      setSlots(slotsResponse.data);
      setBookings(bookingsResponse.data);
    } catch (error) {
      pushToast({ title: "Failed to load admin data", description: getApiError(error), tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleCreateSlot = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      await parkingApi.post("/slots", { ...slotForm, price: Number(slotForm.price) });
      pushToast({ title: "Slot created", description: `${slotForm.slotId} is ready for booking.`, tone: "success" });
      setSlotForm(emptySlotForm);
      await loadAdminData();
    } catch (error) {
      pushToast({ title: "Slot creation failed", description: getApiError(error), tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (slotId, status) => {
    try {
      setUpdatingSlotId(slotId);
      await parkingApi.patch(`/slots/${slotId}/status`, { status });
      pushToast({ title: "Slot updated", description: `${slotId} changed to ${status}.`, tone: "success" });
      await loadAdminData();
    } catch (error) {
      pushToast({ title: "Status update failed", description: getApiError(error), tone: "error" });
    } finally {
      setUpdatingSlotId("");
    }
  };

  if (loading) {
    return <Loader label="Loading admin controls..." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="glass-panel p-6">
          <h2 className="section-title">Add parking slot</h2>
          <p className="muted-copy">Create new slots and make them visible to users immediately.</p>
          <form className="mt-6 space-y-4" onSubmit={handleCreateSlot}>
            <input
              className="input-shell"
              placeholder="Slot ID"
              value={slotForm.slotId}
              onChange={(event) => setSlotForm({ ...slotForm, slotId: event.target.value })}
              required
            />
            <input
              className="input-shell"
              placeholder="Location"
              value={slotForm.location}
              onChange={(event) => setSlotForm({ ...slotForm, location: event.target.value })}
              required
            />
            <input
              className="input-shell"
              type="number"
              min="0"
              placeholder="Price"
              value={slotForm.price}
              onChange={(event) => setSlotForm({ ...slotForm, price: event.target.value })}
              required
            />
            <button type="submit" className="button-primary w-full" disabled={submitting}>
              {submitting ? "Creating slot..." : "Create slot"}
            </button>
          </form>
        </section>

        <section className="glass-panel p-6">
          <h2 className="section-title">Manage slots</h2>
          <p className="muted-copy">Update live slot states, including blocking and releasing inventory.</p>
          <div className="mt-5 space-y-4">
            {slots.map((slot) => (
              <div key={slot.slotId} className="rounded-3xl border border-ink/5 bg-white/75 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-lg font-semibold">{slot.slotId}</p>
                    <p className="text-sm text-slate">
                      {slot.location} • Rs {slot.price}
                    </p>
                  </div>
                  <select
                    className="input-shell max-w-[220px]"
                    value={slot.status}
                    onChange={(event) => handleStatusChange(slot.slotId, event.target.value)}
                    disabled={updatingSlotId === slot.slotId}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="glass-panel p-6">
        <h2 className="section-title">All bookings</h2>
        <p className="muted-copy">Admin-wide booking visibility across users and statuses.</p>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-slate">
                <th className="pb-3 pr-4 font-medium">Booking ID</th>
                <th className="pb-3 pr-4 font-medium">User</th>
                <th className="pb-3 pr-4 font-medium">Slot</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Amount</th>
                <th className="pb-3 pr-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.bookingId} className="border-t border-ink/5">
                  <td className="py-3 pr-4 font-medium">{booking.bookingId}</td>
                  <td className="py-3 pr-4">{booking.userEmail}</td>
                  <td className="py-3 pr-4">{booking.slotId}</td>
                  <td className="py-3 pr-4 capitalize">{booking.status}</td>
                  <td className="py-3 pr-4">Rs {booking.amount}</td>
                  <td className="py-3 pr-4">{new Date(booking.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

