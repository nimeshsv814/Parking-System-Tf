const statusStyles = {
  available: {
    dot: "bg-mint",
    badge: "bg-mint/15 text-green-900",
  },
  reserved: {
    dot: "bg-amber",
    badge: "bg-amber/20 text-amber-950",
  },
  occupied: {
    dot: "bg-ember",
    badge: "bg-ember/15 text-red-900",
  },
  blocked: {
    dot: "bg-slate",
    badge: "bg-slate/20 text-slate-700",
  },
};

export const SlotCard = ({ slot, action, actionLabel, disabled, priceLabel }) => {
  const style = statusStyles[slot.status] || statusStyles.blocked;

  return (
    <div className="glass-panel flex h-full flex-col justify-between p-5 transition duration-300 hover:-translate-y-1">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate">Slot</p>
            <h3 className="mt-1 text-2xl font-semibold">{slot.slotId}</h3>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${style.badge}`}>
            {slot.status}
          </span>
        </div>
        <p className="mt-4 text-sm text-slate">{slot.location}</p>
        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`status-dot ${style.dot}`} />
            <span className="text-sm text-slate">Real-time status</span>
          </div>
          <p className="text-right text-sm font-semibold">
            {priceLabel || `2W Rs ${slot.pricing?.twoWheeler ?? "-"} / hr | 4W Rs ${slot.pricing?.fourWheeler ?? "-"} / hr`}
          </p>
        </div>
      </div>

      {action && (
        <button type="button" className="button-primary mt-6 w-full" onClick={action} disabled={disabled}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

