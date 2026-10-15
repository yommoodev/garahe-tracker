import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../AuthContext";
import { supabase } from "../lib/supabase";

type MaintenanceRecord = {
  id: string;
  title: string;
  category: string;
  service_date: string;
  cost: number;
};

type FuelLog = {
  id: string;
  fill_date: string;
  odometer: number;
  liters: number;
  price_per_liter: number;
  total_cost: number;
  full_tank: boolean;
};

type AnalyticsData = {
  maintenance: MaintenanceRecord[];
  fuel: FuelLog[];
};

const php = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const numberFormat = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 1,
  }).format(value);

const CHART_COLORS = [
  "#f97316",
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#94a3b8",
];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function getLastSixMonths() {
  const now = new Date();

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - (5 - index),
      1,
    );

    return {
      key: monthKey(date),
      label: date.toLocaleDateString("en-PH", { month: "short" }),
    };
  });
}

async function fetchAnalytics(userId: string): Promise<AnalyticsData> {
  const [maintenanceResult, fuelResult] = await Promise.all([
    supabase
      .from("maintenance_records")
      .select("id, title, category, service_date, cost")
      .eq("user_id", userId)
      .order("service_date", { ascending: true }),

    supabase
      .from("fuel_logs")
      .select(
        "id, fill_date, odometer, liters, price_per_liter, total_cost, full_tank",
      )
      .eq("user_id", userId)
      .order("fill_date", { ascending: true }),
  ]);

  if (maintenanceResult.error) {
    throw maintenanceResult.error;
  }

  if (fuelResult.error) {
    throw fuelResult.error;
  }

  return {
    maintenance: (maintenanceResult.data ?? []) as MaintenanceRecord[],
    fuel: (fuelResult.data ?? []) as FuelLog[],
  };
}

export default function AnalyticsPage() {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id;

  const {
    data,
    error,
    isPending,
    isFetching,
    refetch,
  } = useQuery<AnalyticsData, Error>({
    queryKey: ["analytics", userId],
    queryFn: () => {
      if (!userId) {
        throw new Error("Please sign in again.");
      }

      return fetchAnalytics(userId);
    },
    enabled: Boolean(userId) && !authLoading,
  });

  const maintenance = data?.maintenance ?? [];
  const fuel = data?.fuel ?? [];

  const analytics = useMemo(() => {
    const maintenanceTotal = maintenance.reduce(
      (sum, record) => sum + Number(record.cost || 0),
      0,
    );

    const fuelTotal = fuel.reduce(
      (sum, log) => sum + Number(log.total_cost || 0),
      0,
    );

    const totalLiters = fuel.reduce(
      (sum, log) => sum + Number(log.liters || 0),
      0,
    );

    const averagePrice =
      totalLiters > 0 ? fuelTotal / totalLiters : 0;

    const months = getLastSixMonths();

    const monthly = months.map((month) => {
      const maintenanceCost = maintenance
        .filter((record) => record.service_date.startsWith(month.key))
        .reduce((sum, record) => sum + Number(record.cost || 0), 0);

      const fuelCost = fuel
        .filter((log) => log.fill_date.startsWith(month.key))
        .reduce((sum, log) => sum + Number(log.total_cost || 0), 0);

      return {
        month: month.label,
        maintenance: maintenanceCost,
        fuel: fuelCost,
        total: maintenanceCost + fuelCost,
      };
    });

    const categoryTotals = new Map<string, number>();

    for (const record of maintenance) {
      const category = (record.category || "other")
        .replace(/[_-]/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

      categoryTotals.set(
        category,
        (categoryTotals.get(category) ?? 0) + Number(record.cost || 0),
      );
    }

    const categories = Array.from(categoryTotals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Estimate fuel efficiency only between consecutive full-tank fills.
    // Both fills must be marked full-tank, and the odometer must increase.
    const sortedFuel = [...fuel].sort(
      (a, b) =>
        a.odometer - b.odometer ||
        a.fill_date.localeCompare(b.fill_date),
    );

    const efficiencyIntervals: number[] = [];

    for (let index = 1; index < sortedFuel.length; index += 1) {
      const previous = sortedFuel[index - 1];
      const current = sortedFuel[index];
      const distance = current.odometer - previous.odometer;

      if (
        previous.full_tank &&
        current.full_tank &&
        distance > 0 &&
        Number(current.liters) > 0
      ) {
        efficiencyIntervals.push(distance / Number(current.liters));
      }
    }

    const averageEfficiency =
      efficiencyIntervals.length > 0
        ? efficiencyIntervals.reduce((sum, value) => sum + value, 0) /
          efficiencyIntervals.length
        : null;

    return {
      maintenanceTotal,
      fuelTotal,
      totalSpent: maintenanceTotal + fuelTotal,
      totalLiters,
      averagePrice,
      monthly,
      categories,
      averageEfficiency,
    };
  }, [maintenance, fuel]);

  if (authLoading || isPending) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <p className="text-slate-400">Loading your analytics...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <p className="text-slate-400">
          Please sign in to view your analytics.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-400">
            Garahe Tracker
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Analytics
          </h1>
          <p className="mt-2 text-slate-400">
            Understand your vehicle running costs and fuel usage.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
          >
            <p>
              {error.message || "Unable to load analytics."}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 rounded-lg border border-red-400/30 px-3 py-2 font-medium hover:bg-red-500/10"
            >
              Try again
            </button>
          </div>
        )}

        {isFetching && !isPending && (
          <p className="text-xs text-slate-500">
            Refreshing analytics...
          </p>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total spending"
            value={php(analytics.totalSpent)}
          />
          <StatCard
            label="Maintenance"
            value={php(analytics.maintenanceTotal)}
            detail={`${maintenance.length} records`}
          />
          <StatCard
            label="Fuel"
            value={php(analytics.fuelTotal)}
            detail={`${fuel.length} fill-ups`}
          />
          <StatCard
            label="Fuel logged"
            value={`${numberFormat(analytics.totalLiters)} L`}
            detail={
              analytics.averagePrice > 0
                ? `${php(analytics.averagePrice)} average per liter`
                : "Average price unavailable"
            }
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold">Monthly expenses</h2>
              <p className="mt-1 text-sm text-slate-400">
                Maintenance and fuel costs over the last six calendar months
              </p>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.monthly}
                  margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="#334155"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    axisLine={{ stroke: "#475569" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={65}
                    tickFormatter={(value: number) =>
                      value >= 1000
                        ? `₱${Math.round(value / 1000)}k`
                        : `₱${value}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 12,
                      color: "#f1f5f9",
                    }}
                    formatter={(value) => php(Number(value ?? 0))}
                  />
                  <Bar
                    dataKey="maintenance"
                    name="Maintenance"
                    fill="#f97316"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="fuel"
                    name="Fuel"
                    fill="#38bdf8"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-wrap gap-5 text-xs text-slate-400">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-orange-500" />
                Maintenance
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-sky-400" />
                Fuel
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">
                Maintenance by category
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                How your service spending is distributed
              </p>
            </div>

            {analytics.categories.length === 0 ? (
              <EmptyState message="Add maintenance records to see category breakdowns." />
            ) : (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.categories}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {analytics.categories.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: 12,
                          color: "#f1f5f9",
                        }}
                        formatter={(value) => php(Number(value ?? 0))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {analytics.categories.map((category, index) => (
                    <div
                      key={category.name}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-slate-300">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{
                            backgroundColor:
                              CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                        <span className="truncate">{category.name}</span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {php(category.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Fuel overview</h2>
            <p className="mt-1 text-sm text-slate-400">
              Based on your saved fuel logs
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MiniStat
                label="Total fuel cost"
                value={php(analytics.fuelTotal)}
              />
              <MiniStat
                label="Total liters"
                value={`${numberFormat(analytics.totalLiters)} L`}
              />
              <MiniStat
                label="Average price per liter"
                value={
                  analytics.averagePrice > 0
                    ? php(analytics.averagePrice)
                    : "—"
                }
              />
              <MiniStat
                label="Estimated fuel efficiency"
                value={
                  analytics.averageEfficiency !== null
                    ? `${numberFormat(analytics.averageEfficiency)} km/L`
                    : "Not enough data"
                }
              />
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Fuel efficiency is an estimate from consecutive full-tank
              entries with increasing odometer readings. Keep odometer units
              consistent and log each fill-up for better results.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Spending summary</h2>
            <p className="mt-1 text-sm text-slate-400">
              Where your vehicle expenses are going
            </p>

            <div className="mt-6 space-y-5">
              <SpendingBar
                label="Maintenance"
                amount={analytics.maintenanceTotal}
                total={analytics.totalSpent}
                color="bg-orange-500"
              />
              <SpendingBar
                label="Fuel"
                amount={analytics.fuelTotal}
                total={analytics.totalSpent}
                color="bg-sky-400"
              />
            </div>

            <div className="mt-6 border-t border-slate-800 pt-5">
              <p className="text-sm text-slate-400">Total recorded spending</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {php(analytics.totalSpent)}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Includes all maintenance and fuel records currently saved.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 break-words text-2xl font-bold tracking-tight">
        {value}
      </p>
      {detail && <p className="mt-2 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold">{value}</p>
    </div>
  );
}

function SpendingBar({
  label,
  amount,
  total,
  color,
}: {
  label: string;
  amount: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (amount / total) * 100 : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-right font-medium tabular-nums">
          {php(amount)}{" "}
          <span className="text-xs text-slate-500">
            ({percentage.toFixed(1)}%)
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}
