export const StatCard = ({ label, value, accent, hint }) => (
  <div className="glass-panel p-5">
    <div className="flex items-center justify-between">
      <p className="text-sm text-slate">{label}</p>
      <div className={`h-3 w-3 rounded-full ${accent}`} />
    </div>
    <p className="mt-4 text-3xl font-semibold text-ink">{value}</p>
    <p className="mt-2 text-sm text-slate">{hint}</p>
  </div>
);

