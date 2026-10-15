import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { supabase } from "../lib/supabase";

type Vehicle = {
  id: string;
  make: string;
  model: string;
  model_year: number | null;
  nickname: string | null;
  current_odometer: number;
  odometer_unit: string;
};

type FuelLog = {
  id: string;
  user_id: string;
  vehicle_id: string;
  fill_date: string;
  odometer: number;
  liters: number;
  price_per_liter: number;
  total_cost: number;
  fuel_type: string | null;
  full_tank: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type FuelForm = {
  fill_date: string;
  odometer: string;
  liters: string;
  price_per_liter: string;
  fuel_type: string;
  full_tank: boolean;
  notes: string;
};

type FuelPayload = {
  user_id: string;
  vehicle_id: string;
  fill_date: string;
  odometer: number;
  liters: number;
  price_per_liter: number;
  total_cost: number;
  fuel_type: string | null;
  full_tank: boolean;
  notes: string | null;
};

function getToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const emptyForm: FuelForm = {
  fill_date: getToday(),
  odometer: "",
  liters: "",
  price_per_liter: "",
  fuel_type: "Gasoline",
  full_tank: true,
  notes: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);
}

async function fetchVehicles(userId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select(
      "id, make, model, model_year, nickname, current_odometer, odometer_unit",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as Vehicle[];
}

async function fetchFuelLogs(
  userId: string,
  vehicleId: string,
): Promise<FuelLog[]> {
  const { data, error } = await supabase
    .from("fuel_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId)
    .order("fill_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as FuelLog[];
}

export default function FuelPage() {
  const { session, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? null;

  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [form, setForm] = useState<FuelForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const vehiclesQuery = useQuery({
    queryKey: ["vehicles", userId],
    queryFn: () => {
      if (!userId) throw new Error("Please sign in to view your vehicles.");
      return fetchVehicles(userId);
    },
    enabled: Boolean(userId),
  });

  const vehicles = vehiclesQuery.data ?? [];

  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === selectedVehicleId,
  );

  // Keep a valid selection when vehicles load or the selected vehicle is removed.
  const activeVehicleId =
    selectedVehicle?.id ?? vehicles[0]?.id ?? "";

  const activeVehicle = vehicles.find(
    (vehicle) => vehicle.id === activeVehicleId,
  );

  const fuelQuery = useQuery({
    queryKey: ["fuel", userId, activeVehicleId],
    queryFn: () => {
      if (!userId || !activeVehicleId) {
        throw new Error("Select a vehicle to view its fuel logs.");
      }

      return fetchFuelLogs(userId, activeVehicleId);
    },
    enabled: Boolean(userId && activeVehicleId),
  });

  const logs = fuelQuery.data ?? [];

  const liters = Number(form.liters);
  const pricePerLiter = Number(form.price_per_liter);

  const calculatedCost =
    form.liters.trim() !== "" &&
    form.price_per_liter.trim() !== "" &&
    Number.isFinite(liters) &&
    Number.isFinite(pricePerLiter)
      ? liters * pricePerLiter
      : 0;

  const totalSpent = logs.reduce(
    (sum, log) => sum + Number(log.total_cost || 0),
    0,
  );

  // Reset the form when switching to another vehicle.
  useEffect(() => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setSuccess("");
  }, [activeVehicleId]);

  const saveMutation = useMutation({
    mutationFn: async ({
      payload,
      recordId,
      vehicleId,
    }: {
      payload: FuelPayload;
      recordId: string | null;
      vehicleId: string;
    }) => {
      if (recordId) {
        const { data, error: updateError } = await supabase
          .from("fuel_logs")
          .update(payload)
          .eq("id", recordId)
          .eq("user_id", payload.user_id)
          .eq("vehicle_id", vehicleId)
          .select("id")
          .maybeSingle();

        if (updateError) throw updateError;

        if (!data) {
          throw new Error(
            "No fuel log was changed. It may have been deleted or you may not have access to it.",
          );
        }

        return { wasEditing: true };
      }

      const { data, error: insertError } = await supabase
        .from("fuel_logs")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) throw insertError;
      if (!data) throw new Error("The fuel log could not be created.");

      return { wasEditing: false };
    },
    onSuccess: async (result) => {
      setSuccess(result.wasEditing ? "Fuel log updated." : "Fuel log added.");
      setError("");
      setEditingId(null);
      setForm({ ...emptyForm });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["fuel", userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["dashboard", userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["analytics", userId],
        }),
      ]);
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message || "Unable to save the fuel log.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (log: FuelLog) => {
      if (!userId) {
        throw new Error("Your session could not be verified. Please sign in again.");
      }

      const { data, error: deleteError } = await supabase
        .from("fuel_logs")
        .delete()
        .eq("id", log.id)
        .eq("user_id", userId)
        .eq("vehicle_id", log.vehicle_id)
        .select("id")
        .maybeSingle();

      if (deleteError) throw deleteError;

      if (!data) {
        throw new Error(
          "No fuel log was deleted. It may already have been removed or you may not have access to it.",
        );
      }

      return log.id;
    },
    onSuccess: async (deletedId) => {
      if (editingId === deletedId) {
        setEditingId(null);
        setForm({ ...emptyForm });
      }

      setError("");
      setSuccess("Fuel log deleted.");

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["fuel", userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["dashboard", userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["analytics", userId],
        }),
      ]);
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message || "Unable to delete the fuel log.");
    },
  });

  function updateForm<K extends keyof FuelForm>(
    field: K,
    value: FuelForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEditing(log: FuelLog) {
    setEditingId(log.id);
    setForm({
      fill_date: log.fill_date,
      odometer: String(log.odometer),
      liters: String(log.liters),
      price_per_liter: String(log.price_per_liter),
      fuel_type: log.fuel_type ?? "Gasoline",
      full_tank: log.full_tank,
      notes: log.notes ?? "",
    });

    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setSuccess("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!userId) {
      setError("Your session could not be verified. Please sign in again.");
      return;
    }

    if (!activeVehicleId) {
      setError("Add a vehicle before logging a fill-up.");
      return;
    }

    const odometer = Number(form.odometer);
    const quantity = Number(form.liters);
    const price = Number(form.price_per_liter);

    if (
      form.odometer.trim() === "" ||
      !Number.isInteger(odometer) ||
      odometer < 0
    ) {
      setError("Enter a valid non-negative whole-number odometer reading.");
      return;
    }

    if (
      form.liters.trim() === "" ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      setError("Liters must be greater than zero.");
      return;
    }

    if (
      form.price_per_liter.trim() === "" ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      setError("Price per liter must be greater than zero.");
      return;
    }

    if (!form.fill_date) {
      setError("Choose the fill-up date.");
      return;
    }

    const totalCost = Math.round(quantity * price * 100) / 100;

    const payload: FuelPayload = {
      user_id: userId,
      vehicle_id: activeVehicleId,
      fill_date: form.fill_date,
      odometer,
      liters: quantity,
      price_per_liter: price,
      total_cost: totalCost,
      fuel_type: form.fuel_type || null,
      full_tank: form.full_tank,
      notes: form.notes.trim() || null,
    };

    saveMutation.mutate({
      payload,
      recordId: editingId,
      vehicleId: activeVehicleId,
    });
  }

  function handleDelete(log: FuelLog) {
    const confirmed = window.confirm(
      `Delete the fuel log from ${log.fill_date}? This cannot be undone.`,
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    deleteMutation.mutate(log);
  }

  if (authLoading || (userId && vehiclesQuery.isPending)) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-300">
        Loading your vehicles...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
            GarageLog / Fuel tracking
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Fuel Logs
          </h1>
          <p className="mt-2 text-slate-400">
            Track fill-ups, fuel spending, and odometer readings.
          </p>
        </header>

        {!userId && !authLoading && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
          >
            Your session could not be verified. Please sign in again.
          </div>
        )}

        {vehiclesQuery.isError && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
          >
            <p>Could not load vehicles: {vehiclesQuery.error.message}</p>
            <button
              type="button"
              onClick={() => void vehiclesQuery.refetch()}
              className="mt-3 rounded-lg border border-red-400/30 px-3 py-2 font-semibold hover:bg-red-500/10"
            >
              Retry
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300"
          >
            {success}
          </div>
        )}

        {!vehiclesQuery.isError && vehicles.length === 0 ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">No vehicles yet</h2>
            <p className="mt-2 text-slate-400">
              Add a vehicle before recording fuel fill-ups.
            </p>
            <Link
              to="/vehicles"
              className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold hover:bg-blue-500"
            >
              Go to Vehicles
            </Link>
          </section>
        ) : vehicles.length > 0 ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">
                  Fuel fill-ups recorded
                </p>
                <p className="mt-2 text-3xl font-bold">{logs.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Total fuel spending</p>
                <p className="mt-2 text-3xl font-bold">
                  {formatCurrency(totalSpent)}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <h2 className="text-xl font-semibold">Select vehicle</h2>
              <p className="mb-4 mt-1 text-sm text-slate-400">
                Fuel logs are displayed separately for each vehicle.
              </p>

              <select
                className={inputClass}
                value={activeVehicleId}
                onChange={(event) => {
                  setSelectedVehicleId(event.target.value);
                  setEditingId(null);
                  setForm({ ...emptyForm });
                  setError("");
                  setSuccess("");
                }}
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.nickname ||
                      `${vehicle.make} ${vehicle.model}${vehicle.model_year ? ` (${vehicle.model_year})` : ""}`}
                  </option>
                ))}
              </select>

              {activeVehicle && (
                <p className="mt-3 text-sm text-slate-400">
                  Current odometer:{" "}
                  <span className="font-medium text-slate-200">
                    {activeVehicle.current_odometer.toLocaleString()}{" "}
                    {activeVehicle.odometer_unit}
                  </span>
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <h2 className="text-xl font-semibold">
                {editingId ? "Edit fuel log" : "Record a fill-up"}
              </h2>
              <p className="mb-6 mt-1 text-sm text-slate-400">
                Enter the details from your fuel receipt.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Fill-up date *">
                    <input
                      className={inputClass}
                      type="date"
                      value={form.fill_date}
                      onChange={(event) =>
                        updateForm("fill_date", event.target.value)
                      }
                      required
                    />
                  </Field>

                  <Field
                    label={`Odometer (${activeVehicle?.odometer_unit ?? "km"}) *`}
                  >
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="1"
                      value={form.odometer}
                      onChange={(event) =>
                        updateForm("odometer", event.target.value)
                      }
                      placeholder="e.g. 120000"
                      required
                    />
                  </Field>

                  <Field label="Fuel quantity (liters) *">
                    <input
                      className={inputClass}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.liters}
                      onChange={(event) =>
                        updateForm("liters", event.target.value)
                      }
                      placeholder="e.g. 35.50"
                      required
                    />
                  </Field>

                  <Field label="Price per liter (PHP) *">
                    <input
                      className={inputClass}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.price_per_liter}
                      onChange={(event) =>
                        updateForm("price_per_liter", event.target.value)
                      }
                      placeholder="e.g. 62.50"
                      required
                    />
                  </Field>

                  <Field label="Fuel type">
                    <select
                      className={inputClass}
                      value={form.fuel_type}
                      onChange={(event) =>
                        updateForm("fuel_type", event.target.value)
                      }
                    >
                      <option value="Gasoline">Gasoline</option>
                      <option value="Diesel">Diesel</option>
                      <option value="Premium gasoline">
                        Premium gasoline
                      </option>
                      <option value="Regular gasoline">
                        Regular gasoline
                      </option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>

                  <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                    <p className="text-sm text-slate-400">Calculated total</p>
                    <p className="mt-2 text-2xl font-bold text-emerald-400">
                      {formatCurrency(calculatedCost)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Liters × price per liter
                    </p>
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-slate-700 p-4">
                  <input
                    type="checkbox"
                    checked={form.full_tank}
                    onChange={(event) =>
                      updateForm("full_tank", event.target.checked)
                    }
                    className="mt-1 h-4 w-4 accent-blue-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-200">
                      Full tank
                    </span>
                    <span className="mt-1 block text-sm text-slate-400">
                      Check this if you filled the tank completely. This helps
                      calculate fuel economy more reliably later.
                    </span>
                  </span>
                </label>

                <Field label="Notes (optional)">
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={form.notes}
                    onChange={(event) =>
                      updateForm("notes", event.target.value)
                    }
                    placeholder="Fuel station, receipt details, or other notes..."
                    maxLength={2000}
                  />
                </Field>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saveMutation.isPending
                      ? "Saving..."
                      : editingId
                        ? "Save Changes"
                        : "Add Fuel Log"}
                  </button>

                  {editingId && (
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold">Fuel history</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {activeVehicle?.nickname ||
                    `${activeVehicle?.make ?? ""} ${activeVehicle?.model ?? ""}`}
                </p>
              </div>

              {fuelQuery.isPending ? (
                <p className="py-8 text-slate-400">Loading fuel logs...</p>
              ) : fuelQuery.isError ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300"
                >
                  <p>Could not load fuel logs: {fuelQuery.error.message}</p>
                  <button
                    type="button"
                    onClick={() => void fuelQuery.refetch()}
                    className="mt-3 rounded-lg border border-red-400/30 px-3 py-2 font-semibold hover:bg-red-500/10"
                  >
                    Retry
                  </button>
                </div>
              ) : logs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
                  <h3 className="font-semibold">No fuel logs yet</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Add your first fill-up using the form above.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <article
                      key={log.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold">
                              {log.fuel_type || "Fuel fill-up"}
                            </h3>
                            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                              {log.full_tank ? "Full tank" : "Partial fill"}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-400">
                            {new Date(
                              `${log.fill_date}T00:00:00`,
                            ).toLocaleDateString("en-PH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                            {" · "}
                            {log.odometer.toLocaleString()}{" "}
                            {activeVehicle?.odometer_unit ?? "km"}
                          </p>

                          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                            <div>
                              <p className="text-slate-500">Fuel volume</p>
                              <p className="mt-1 font-medium">
                                {Number(log.liters).toFixed(2)} L
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Price per liter</p>
                              <p className="mt-1 font-medium">
                                {formatCurrency(Number(log.price_per_liter))}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Total cost</p>
                              <p className="mt-1 font-semibold text-emerald-400">
                                {formatCurrency(Number(log.total_cost))}
                              </p>
                            </div>
                          </div>

                          {log.notes && (
                            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-400">
                              {log.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2 sm:justify-end">
                          <button
                            type="button"
                            onClick={() => startEditing(log)}
                            disabled={deleteMutation.isPending || saveMutation.isPending}
                            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(log)}
                            disabled={deleteMutation.isPending || saveMutation.isPending}
                            className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            {deleteMutation.isPending ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
