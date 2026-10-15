
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const navItems = [
  { label: "Dashboard", path: "/", icon: "⌂", end: true },
  { label: "Vehicles", path: "/vehicles", icon: "▣" },
  { label: "Maintenance", path: "/maintenance", icon: "⚙" },
  { label: "Fuel Logs", path: "/fuel", icon: "⛽" },
  { label: "Reminders", path: "/reminders", icon: "◷" },
  { label: "Analytics", path: "/analytics", icon: "▥" },
];

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
    isActive
      ? "bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20"
      : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
  ].join(" ");

export default function AppLayout() {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError("");

    const { error } = await supabase.auth.signOut();

    setSigningOut(false);

    if (error) {
      setSignOutError(error.message);
      return;
    }

    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-800 bg-[#0d1017] px-4 py-6 lg:flex">
        <NavLink to="/" className="mb-10 flex items-center gap-3 px-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-lg font-black text-slate-950">
            G
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">Garahe Tracker</p>
            <p className="text-xs text-slate-500">Vehicle management</p>
          </div>
        </NavLink>

        <p className="mb-3 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          Workspace
        </p>

        <nav className="flex-1 space-y-1" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={linkClasses}
            >
              <span className="w-5 text-center text-base" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 border-t border-slate-800 pt-4">
          {signOutError && (
            <p role="alert" className="mb-3 px-2 text-xs text-red-400">
              {signOutError}
            </p>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="w-5 text-center" aria-hidden="true">
              ↪
            </span>
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
          <p className="mt-4 px-4 text-xs text-slate-600">Garahe Tracker · MVP</p>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-800 bg-[#0d1017] px-4 py-4 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <NavLink to="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 font-black text-slate-950">
                G
              </div>
              <span className="font-bold tracking-tight">Garahe Tracker</span>
            </NavLink>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>

          <nav
            className="mt-4 flex gap-2 overflow-x-auto pb-1"
            aria-label="Mobile navigation"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-orange-500/10 text-orange-400"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {signOutError && (
            <p role="alert" className="mt-3 text-xs text-red-400">
              {signOutError}
            </p>
          )}
        </header>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
