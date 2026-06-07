export const Loader = ({ label = "Loading..." }) => (
  <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink/15 border-t-ink" />
    <span>{label}</span>
  </div>
);

