
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { supabase } from "../lib/supabase";

type Vehicle = {
  id: string;
  nickname: string | null;
  make: string;
  model: string;
  model_year: number | null;
  current_odometer: number;
  odometer_unit: string;
};

type MaintenanceRecord = {
  id: string;
  vehicle_id: string;
  title: string;
  category: string;
  service_date: string;
  cost: number;
  currency: string;
  created_at: string;
};

type FuelLog = {
  id: string;
  vehicle_id: string;
  fill_date: string;
  total_cost: number;
  liters: number;
  created_at: string;
};

type Reminder = {
  id: string;
  vehicle_id: string;
  title: string;
  due_date: string | null;
  due_odometer: number | null;
  completed_at: string | null;
};

type DashboardData = {
  vehicles: Vehicle[];
  maintenance: MaintenanceRecord[];
  fuel: FuelLog[];
  reminders: Reminder[];
};

const php = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const dateLabel = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const todayString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

async function fetchDashboardData(
  userId: string,
): Promise<DashboardData> {
  const [
    vehiclesResult,
    maintenanceResult,
    fuelResult,
    remindersResult,
  ] = await Promise.all([
    supabase
      .from("vehicles")
      .select(
        "id, nickname, make, model, model_year, current_odometer, odometer_unit",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),

    supabase
      .from("maintenance_records")
      .select(
        "id, vehicle_id, title, category, service_date, cost, currency, created_at",
      )
      .eq("user_id", userId)
      .order("service_date", { ascending: false }),

    supabase
      .from("fuel_logs")
      .select(
        "id, vehicle_id, fill_date, total_cost, liters, created_at",
      )
      .eq("user_id", userId)
      .order("fill_date", { ascending: false }),

    supabase
      .from("maintenance_reminders")
      .select(
        "id, vehicle_id, title, due_date, due_odometer, completed_at",
      )
      .eq("user_id", userId),
  ]);

  const firstError =
    vehiclesResult.error ??
    maintenanceResult.error ??
    fuelResult.error ??
    remindersResult.error;

  if (firstError) {
    throw firstError;
  }

  return {
    vehicles: (vehiclesResult.data ?? []) as Vehicle[],
    maintenance: (maintenanceResult.data ?? []) as MaintenanceRecord[],
    fuel: (fuelResult.data ?? []) as FuelLog[],
    reminders: (remindersResult.data ?? []) as Reminder[],
  };
}

export default function DashboardPage() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const {
    data: dashboardData,
    isPending,
    error,
    refetch,
    isFetching,
  } = useQuery<DashboardData, Error>({
    queryKey: ["dashboard", userId],
    queryFn: () => {
      if (!userId) {
        throw new Error("Please sign in to view your dashboard.");
      }

      return fetchDashboardData(userId);
    },
    enabled: Boolean(userId),
  });

  const data: DashboardData = dashboardData ?? {
    vehicles: [],
    maintenance: [],
    fuel: [],
    reminders: [],
  };

  const today = todayString();

  const maintenanceTotal = data.maintenance.reduce(
    (sum, record) => sum + Number(record.cost || 0),
    0,
  );

  const fuelTotal = data.fuel.reduce(
    (sum, log) => sum + Number(log.total_cost || 0),
    0,
  );

  const pendingReminders = data.reminders.filter(
    (reminder) => !reminder.completed_at,
  );

  const overdueReminders = pendingReminders.filter(
    (reminder) => reminder.due_date && reminder.due_date < today,
  );

  const upcomingReminders = pendingReminders
    .filter(
      (reminder) => !reminder.due_date || reminder.due_date >= today,
    )
    .sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    })
    .slice(0, 5);

  const recentActivity = [
    ...data.maintenance.map((record) => ({
      id: `maintenance-${record.id}`,
      type: "Maintenance",
      title: record.title,
      date: record.service_date,
      cost: Number(record.cost || 0),
    })),
    ...data.fuel.map((log) => ({
      id: `fuel-${log.id}`,
      type: "Fuel",
      title: "Fuel refill",
      date: log.fill_date,
      cost: Number(log.total_cost || 0),
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  if (!userId) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <p className="text-slate-400">
          Please sign in to view your dashboard.
        </p>
      </main>
    );
  }

  if (isPending) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <p className="text-slate-400">
          Loading your Garahe Tracker dashboard...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-400">
              Garahe Tracker
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Dashboard
            </h1>
            <p className="mt-2 text-slate-400">
              Your vehicles, expenses, and maintenance at a glance.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/vehicles"
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-800"
            >
              Manage vehicles
            </Link>
            <Link
              to="/maintenance"
              className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-orange-400"
            >
              + Add service
            </Link>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>
              {error.message || "Unable to load your dashboard."}
            </span>
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="rounded-lg border border-red-400/30 px-3 py-2 font-medium hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isFetching ? "Retrying..." : "Retry"}
            </button>
          </div>
        )}

        {isFetching && (
          <p className="text-xs text-slate-500" role="status">
            Refreshing dashboard data...
          </p>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="My vehicles"
            value={String(data.vehicles.length)}
            detail="Vehicles in your garage"
          />
          <StatCard
            label="Maintenance spending"
            value={php(maintenanceTotal)}
            detail={`${data.maintenance.length} service records`}
          />
          <StatCard
            label="Fuel spending"
            value={php(fuelTotal)}
            detail={`${data.fuel.length} fuel logs`}
          />
          <StatCard
            label="Pending reminders"
            value={String(pendingReminders.length)}
            detail={`${overdueReminders.length} overdue by date`}
            warning={overdueReminders.length > 0}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">My garage</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Current vehicles and odometer readings
                </p>
              </div>
              <Link
                to="/vehicles"
                className="text-sm font-medium text-orange-400 hover:text-orange-300"
              >
                View all
              </Link>
            </div>

            {data.vehicles.length === 0 ? (
              <EmptyState
                message="Your garage is empty."
                link="/vehicles"
                action="Add your first vehicle"
              />
            ) : (
              <div className="space-y-3">
                {data.vehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-semibold">
                        {vehicle.nickname ||
                          `${vehicle.make} ${vehicle.model}`}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {vehicle.model_year
                          ? `${vehicle.model_year} · `
                          : ""}
                        {vehicle.make} {vehicle.model}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="font-semibold tabular-nums">
                        {Number(vehicle.current_odometer).toLocaleString(
                          "en-PH",
                        )}{" "}
                        {vehicle.odometer_unit}
                      </p>
                      <p className="text-xs text-slate-500">Odometer</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  Maintenance reminders
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Keep your next service on schedule
                </p>
              </div>
              <Link
                to="/reminders"
                className="text-sm font-medium text-orange-400 hover:text-orange-300"
              >
                View all
              </Link>
            </div>

            {overdueReminders.length > 0 && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {overdueReminders.length} reminder
                {overdueReminders.length === 1 ? " is" : "s are"} overdue by
                date.
              </div>
            )}

            {upcomingReminders.length === 0 ? (
              <p className="rounded-xl bg-slate-950/60 p-4 text-sm text-slate-400">
                No pending reminders with upcoming dates.
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="rounded-xl border border-slate-800 p-3"
                  >
                    <p className="font-medium">{reminder.title}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {reminder.due_date
                        ? `Due ${dateLabel(reminder.due_date)}`
                        : "Date not set"}
                    </p>
                    {reminder.due_odometer !== null && (
                      <p className="mt-1 text-xs text-slate-500">
                        At{" "}
                        {reminder.due_odometer.toLocaleString("en-PH")}{" "}
                        odometer reading
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Link
              to="/reminders"
              className="mt-4 inline-flex text-sm font-medium text-orange-400 hover:text-orange-300"
            >
              Manage reminders →
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Recent activity</h2>
              <p className="mt-1 text-sm text-slate-400">
                Your latest maintenance and fuel entries
              </p>
            </div>
            <Link
              to="/analytics"
              className="text-sm font-medium text-orange-400 hover:text-orange-300"
            >
              View analytics
            </Link>
          </div>

          {recentActivity.length === 0 ? (
            <p className="rounded-xl bg-slate-950/60 p-4 text-sm text-slate-400">
              Your activity will appear here when you add service records or
              fuel logs.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="pb-3 pr-4 font-medium">Activity</th>
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((activity) => (
                    <tr
                      key={activity.id}
                      className="border-t border-slate-800"
                    >
                      <td className="py-3 pr-4 font-medium">
                        {activity.title}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                          {activity.type}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-400">
                        {dateLabel(activity.date)}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {php(activity.cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
  warning = false,
}: {
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p
        className={`mt-3 break-words text-2xl font-bold tracking-tight ${
          warning ? "text-red-400" : "text-slate-100"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function EmptyState({
  message,
  link,
  action,
}: {
  message: string;
  link: string;
  action: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
      <p className="text-sm text-slate-400">{message}</p>
      <Link
        to={link}
        className="mt-3 inline-block text-sm font-semibold text-orange-400 hover:text-orange-300"
      >
        {action} →
      </Link>
    </div>
  );
}
