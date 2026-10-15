
import { useState } from "react";
import {
  Activity,
  Bell,
  CarFront,
  ChevronDown,
  CirclePlus,
  Fuel,
  Gauge,
  LayoutDashboard,
  LogOut,
  Settings,
  Wrench,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../AuthContext";

export default function DashboardPage() {
  const { session } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    setSigningOut(true);
    setError("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
      setSigningOut(false);
    }
  }

  const email = session?.user.email ?? "Driver";
  const displayName =
    session?.user.user_metadata?.display_name || email.split("@")[0];

  const navItems = [
    { label: "Overview", icon: LayoutDashboard, active: true },
    { label: "My Vehicles", icon: CarFront, active: false },
    { label: "Maintenance", icon: Wrench, active: false },
    { label: "Fuel Log", icon: Fuel, active: false },
    { label: "Reminders", icon: Bell, active: false },
  ];

  // async function testVehicleAccess() {
  //   const { data, error } = await supabase
  //     .from("vehicles")
  //     .select("id, make, model, user_id");

  //   console.log("Vehicles:", data);
  //   console.log("Error:", error);
  // }

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-white/[0.07] bg-[#0d1017] lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.07] px-6">
          <div className="rounded-xl bg-orange-500 p-2 text-white">
            <CarFront size={23} />
          </div>
          <div>
            <p className="font-bold tracking-tight">GarageLog</p>
            <p className="text-[10px] tracking-[0.18em] text-slate-500">
              VEHICLE MANAGEMENT
            </p>
          </div>
        </div>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            Workspace
          </p>
          <nav className="space-y-1">
            {navItems.map(({ label, icon: Icon, active }) => (
              <button
                key={label}
                disabled={!active}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                  active
                    ? "bg-orange-500/10 font-medium text-orange-400"
                    : "text-slate-500 hover:bg-white/[0.03]"
                }`}
              >
                <Icon size={18} />
                {label}
                {label === "Overview" && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-400" />
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <button
            disabled
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500"
          >
            <Settings size={18} />
            Settings
          </button>
          <div className="mt-3 border-t border-white/[0.07] pt-4">
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 font-semibold text-orange-300">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{email}</p>
              </div>
              <button
                aria-label="Sign out"
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="lg:ml-64">
        <header className="flex h-[76px] items-center justify-between border-b border-white/[0.07] px-5 sm:px-8">
          <div>
            <p className="text-sm text-slate-500">Garage / Overview</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-400 sm:block">
              Welcome, {displayName}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#151923]">
              <Bell size={17} className="text-slate-400" />
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 lg:hidden"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] p-5 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-400">
                Your garage at a glance
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Dashboard
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Your vehicles, maintenance, and ownership costs in one place.
              </p>
            </div>
            <button
              disabled
              title="Vehicle creation is coming in the next milestone"
              className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white opacity-60"
            >
              <CirclePlus size={18} />
              Add vehicle
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-5 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "MY VEHICLES", value: "—", icon: CarFront },
              { label: "MAINTENANCE COST", value: "—", icon: Wrench },
              { label: "FUEL ECONOMY", value: "—", icon: Fuel },
              { label: "UPCOMING SERVICES", value: "—", icon: Activity },
            ].map(({ label, value, icon: Icon }) => (
              <article
                key={label}
                className="rounded-2xl border border-white/[0.07] bg-[#10141c] p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold tracking-[0.15em] text-slate-500">
                    {label}
                  </p>
                  <Icon size={18} className="text-orange-400" />
                </div>
                <p className="mt-6 text-3xl font-semibold">{value}</p>
                <p className="mt-2 text-xs text-slate-600">
                  Will appear when you add your records
                </p>
              </article>
            ))}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <article className="rounded-2xl border border-white/[0.07] bg-[#10141c] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">My Garage</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Your registered vehicles
                  </p>
                </div>
                <CarFront className="text-slate-500" />
              </div>
              <div className="mt-6 flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-5 text-center">
                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <CarFront size={28} className="text-orange-400" />
                </div>
                <h3 className="mt-4 font-medium">Your garage is ready</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Add your first vehicle to start tracking service history,
                  fuel usage, and running costs.
                </p>
              </div>
            </article>

            <article className="rounded-2xl border border-white/[0.07] bg-[#10141c] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Maintenance overview</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Keep your next service in sight
                  </p>
                </div>
                <Gauge className="text-slate-500" />
              </div>
              <div className="mt-6 space-y-3">
                {[
                  "Oil and filter changes",
                  "Tires and brakes",
                  "Battery and fluids",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                  >
                    <span className="text-sm text-slate-400">{item}</span>
                    <ChevronDown size={16} className="text-slate-600" />
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-600">
                These are placeholders. Real service records and reminders
                will be connected in upcoming milestones.
              </p>
            </article>
          </section>

          <p className="mt-8 text-center text-xs text-slate-700">
            GARAGELOG · BUILT FOR EVERY MILE
          </p>
        </div>
      </main>
    </div>
  );
}
