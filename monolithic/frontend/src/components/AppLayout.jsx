import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItemClass = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-medium transition ${
    isActive ? "bg-ink text-white" : "text-ink/80 hover:bg-white/70"
  }`;

export const AppLayout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-16 h-64 w-64 rounded-full bg-mint/20 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-amber/20 blur-3xl" />
      </div>

      <header className="page-shell pt-5">
        <div className="glass-panel flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate">Smart Parking System</p>
            <h1 className="font-serif text-3xl italic text-ink">Park smarter, manage faster.</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NavLink to="/dashboard" className={navItemClass}>
              Dashboard
            </NavLink>
            <NavLink to="/slots" className={navItemClass}>
              Slots
            </NavLink>
            <NavLink to="/bookings" className={navItemClass}>
              Bookings
            </NavLink>
            {user?.role === "admin" && (
              <NavLink to="/admin" className={navItemClass}>
                Admin
              </NavLink>
            )}
            <button type="button" className="button-secondary" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="page-shell pt-4">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate">Signed in as</p>
            <p className="text-lg font-semibold">
              {user?.name} <span className="text-sm font-normal text-slate">({user?.role})</span>
            </p>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
};

