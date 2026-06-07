import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const initialRegisterState = {
  name: "",
  email: "",
  password: "",
  role: "user",
};

export const AuthPage = () => {
  const [mode, setMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState(initialRegisterState);
  const { login, register, loading } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    try {
      await login(loginForm);
      pushToast({ title: "Welcome back", description: "You are now signed in.", tone: "success" });
      navigate("/dashboard");
    } catch (error) {
      pushToast({ title: "Login failed", description: error.message, tone: "error" });
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    try {
      await register(registerForm);
      pushToast({ title: "Account created", description: "Your account is ready to use.", tone: "success" });
      navigate("/dashboard");
    } catch (error) {
      pushToast({ title: "Registration failed", description: error.message, tone: "error" });
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8">
      <div className="absolute inset-0">
        <div className="absolute left-[-5%] top-20 h-72 w-72 animate-float rounded-full bg-mint/25 blur-3xl" />
        <div className="absolute right-[-2%] top-32 h-96 w-96 animate-float rounded-full bg-amber/25 blur-3xl" />
      </div>
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="px-2">
          <p className="text-sm uppercase tracking-[0.35em] text-slate">Cloud Native Parking</p>
          <h1 className="mt-4 max-w-2xl font-serif text-6xl italic leading-none text-ink">
            A smarter way to reserve every parking minute.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate">
            Live slot status, quick booking, mock payments, booking expiry automation, and a full admin control
            center in one responsive platform.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { title: "Real-time slots", copy: "Availability visualized with color-coded status signals." },
              { title: "Fast checkout", copy: "Create a booking and complete payment in a few clicks." },
              { title: "Auto recovery", copy: "Unpaid bookings expire automatically and release slots." },
            ].map((item) => (
              <div key={item.title} className="glass-panel p-4">
                <p className="font-semibold">{item.title}</p>
                <p className="mt-2 text-sm text-slate">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-6 sm:p-8">
          <div className="mb-6 flex rounded-full bg-white/70 p-1">
            <button
              type="button"
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                mode === "login" ? "bg-ink text-white" : "text-slate"
              }`}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                mode === "register" ? "bg-ink text-white" : "text-slate"
              }`}
              onClick={() => setMode("register")}
            >
              Register
            </button>
          </div>

          {mode === "login" ? (
            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="mb-2 block text-sm font-medium">Email</label>
                <input
                  className="input-shell"
                  type="email"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                  placeholder="user@parking.com"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Password</label>
                <input
                  className="input-shell"
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                  placeholder="Enter your password"
                  required
                />
              </div>
              <button className="button-primary w-full" disabled={loading} type="submit">
                {loading ? "Signing in..." : "Sign in"}
              </button>
              <div className="rounded-2xl bg-ink/5 p-4 text-sm text-slate">
                <p>Seed user: `user@parking.com` / `User@123`</p>
                <p>Seed admin: `admin@parking.com` / `Admin@123`</p>
              </div>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleRegister}>
              <div>
                <label className="mb-2 block text-sm font-medium">Full name</label>
                <input
                  className="input-shell"
                  type="text"
                  value={registerForm.name}
                  onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })}
                  placeholder="Your name"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Email</label>
                <input
                  className="input-shell"
                  type="email"
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Password</label>
                <input
                  className="input-shell"
                  type="password"
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                  placeholder="Create a strong password"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Role</label>
                <select
                  className="input-shell"
                  value={registerForm.role}
                  onChange={(event) => setRegisterForm({ ...registerForm, role: event.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button className="button-primary w-full" disabled={loading} type="submit">
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

