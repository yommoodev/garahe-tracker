
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

type MaintenanceRecord = {
  id: string;
  user_id: string;
  vehicle_id: string;
  title: string;
  category: string;
  description: string | null;
  service_date: string;
  odometer: number | null;
  cost: number;
  currency: string;
  shop_name: string | null;
  receipt_path: string | null;
  created_at: string;
  updated_at: string;
};

type MaintenanceForm = {
  title: string;
  category: string;
  description: string;
  service_date: string;
  odometer: string;
  cost: string;
  shop_name: string;
};

type SaveVariables = {
  editingId: string | null;
  vehicleId: string;
  payload: {
    user_id: string;
    vehicle_id: string;
    title: string;
    category: string;
    description: string | null;
    service_date: string;
    odometer: number | null;
    cost: number;
    currency: string;
    shop_name: string | null;
  };
};

const categories = [
  "oil_change",
  "inspection",
  "repair",
  "tires",
  "brakes",
  "battery",
  "fluids",
  "suspension",
  "engine",
  "other",
];

function getToday(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const createEmptyForm = (): MaintenanceForm => ({
  title: "",
  category: "other",
  description: "",
  service_date: getToday(),
  odometer: "",
  cost: "0",
  shop_name: "",
});

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

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500";

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: currency || "PHP",
  }).format(value);
}

function formatCategory(category: string) {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

async function fetchMaintenanceRecords(
  userId: string,
  vehicleId: string,
): Promise<MaintenanceRecord[]> {
  const { data, error } = await supabase
    .from("maintenance_records")
    .select("*")
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId)
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as MaintenanceRecord[];
}

export default function MaintenancePage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [form, setForm] = useState<MaintenanceForm>(createEmptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Cache the user's vehicles.
  const {
    data: vehicles = [],
    isPending: loadingVehicles,
    error: vehiclesError,
    refetch: refetchVehicles,
    isFetching: fetchingVehicles,
  } = useQuery<Vehicle[], Error>({
    queryKey: ["vehicles", userId],
    queryFn: () => fetchVehicles(userId!),
    enabled: Boolean(userId),
  });

  // Use the selected vehicle when valid; otherwise select the first vehicle.
  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === selectedVehicleId,
  );

  const activeVehicleId =
    selectedVehicle?.id ?? vehicles[0]?.id ?? "";

  // Cache maintenance records separately for each user and vehicle.
  const {
    data: records = [],
    isPending: loadingRecords,
    error: recordsError,
    refetch: refetchRecords,
    isFetching: fetchingRecords,
  } = useQuery<MaintenanceRecord[], Error>({
    queryKey: ["maintenance", userId, activeVehicleId],
    queryFn: () => fetchMaintenanceRecords(userId!, activeVehicleId),
    enabled: Boolean(userId && activeVehicleId),
  });

  // Add or edit a maintenance record.
  const saveMutation = useMutation<boolean, Error, SaveVariables>({
    mutationFn: async ({ editingId, vehicleId, payload }) => {
      const result = editingId
        ? await supabase
            .from("maintenance_records")
            .update(payload)
            .eq("id", editingId)
            .eq("user_id", userId!)
            .eq("vehicle_id", vehicleId)
            .select("id")
            .maybeSingle()
        : await supabase
            .from("maintenance_records")
            .insert(payload)
            .select("id")
            .single();

      if (result.error) throw result.error;

      if (!result.data) {
        throw new Error(
          "No record was changed. It may have been deleted or you may not have access to it.",
        );
      }

      return true;
    },

    onSuccess: async (_result, variables) => {
      setSuccess(
        variables.editingId
          ? "Maintenance record updated."
          : "Maintenance record added.",
      );

      setEditingId(null);
      setForm(createEmptyForm());
      setError("");

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["maintenance", userId, variables.vehicleId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["dashboard", userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["analytics", userId],
        }),
      ]);
    },

    onError: (mutationError) => {
      setError(mutationError.message || "Unable to save the maintenance record.");
    },
  });

  // Delete a maintenance record.
  const deleteMutation = useMutation<void, Error, MaintenanceRecord>({
    mutationFn: async (record) => {
      const { data, error: deleteError } = await supabase
        .from("maintenance_records")
        .delete()
        .eq("id", record.id)
        .eq("user_id", userId!)
        .eq("vehicle_id", record.vehicle_id)
        .select("id");

      if (deleteError) throw deleteError;

      if (!data || data.length === 0) {
        throw new Error(
          "The record was not deleted. It may have already been removed or you may not have access to it.",
        );
      }
    },

    onSuccess: async (_result, record) => {
      if (editingId === record.id) {
        setEditingId(null);
        setForm(createEmptyForm());
      }

      setError("");
      setSuccess("Maintenance record deleted.");

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["maintenance", userId, record.vehicle_id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["dashboard", userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["analytics", userId],
        }),
      ]);
    },

    onError: (mutationError) => {
      setError(mutationError.message || "Unable to delete the maintenance record.");
    },
  });

  function updateForm<K extends keyof MaintenanceForm>(
    field: K,
    value: MaintenanceForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleVehicleChange(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
    setEditingId(null);
    setForm(createEmptyForm());
    setError("");
    setSuccess("");
  }

  function startEditing(record: MaintenanceRecord) {
    setEditingId(record.id);
    setForm({
      title: record.title,
      category: record.category,
      description: record.description ?? "",
      service_date: record.service_date,
      odometer:
        record.odometer === null ? "" : String(record.odometer),
      cost: String(record.cost),
      shop_name: record.shop_name ?? "",
    });

    setError("");
    setSuccess("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(createEmptyForm());
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!userId) {
      setError("Your session could not be verified. Please sign in again.");
      return;
    }

    if (!activeVehicleId) {
      setError("Add a vehicle before creating a maintenance record.");
      return;
    }

    if (!form.title.trim()) {
      setError("Enter a service or repair title.");
      return;
    }

    if (!form.service_date) {
      setError("Select a service date.");
      return;
    }

    const cost = Number(form.cost);
    const odometer =
      form.odometer.trim() === "" ? null : Number(form.odometer);

    if (!Number.isFinite(cost) || cost < 0) {
      setError("Cost must be a valid non-negative number.");
      return;
    }

    if (
      odometer !== null &&
      (!Number.isInteger(odometer) || odometer < 0)
    ) {
      setError("Odometer must be a non-negative whole number.");
      return;
    }

    const payload: SaveVariables["payload"] = {
      user_id: userId,
      vehicle_id: activeVehicleId,
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim() || null,
      service_date: form.service_date,
      odometer,
      cost,
      currency: "PHP",
      shop_name: form.shop_name.trim() || null,
    };

    saveMutation.mutate({
      editingId,
      vehicleId: activeVehicleId,
      payload,
    });
  }

  function handleDelete(record: MaintenanceRecord) {
    const confirmed = window.confirm(
      `Delete "${record.title}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    deleteMutation.mutate(record);
  }

  const totalSpent = records.reduce(
    (total, record) => total + Number(record.cost || 0),
    0,
  );

  const loading = loadingVehicles || (!userId ? false : loadingRecords);

  if (!userId) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-300">
        Please sign in to view your maintenance records.
      </main>
    );
  }

  if (loadingVehicles && vehicles.length === 0) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-300">
        Loading your vehicles...
      </main>
    );
  }

  if (vehiclesError && vehicles.length === 0) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div
          role="alert"
          className="max-w-xl rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-300"
        >
          <p>Unable to load your vehicles: {vehiclesError.message}</p>
          <button
            type="button"
            onClick={() => void refetchVehicles()}
            disabled={fetchingVehicles}
            className="mt-4 rounded-lg border border-red-400/30 px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {fetchingVehicles ? "Retrying..." : "Retry"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
            GarageLog / Service history
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Maintenance Records
          </h1>
          <p className="mt-2 text-slate-400">
            Keep track of repairs, servicing, and the money spent on your vehicle.
          </p>
        </header>

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

        {vehicles.length === 0 ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">No vehicles yet</h2>
            <p className="mt-2 text-slate-400">
              Add a vehicle first, then you can attach maintenance records to it.
            </p>
            <Link
              to="/vehicles"
              className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Go to Vehicles
            </Link>
          </section>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">
                  Records for this vehicle
                </p>
                <p className="mt-2 text-3xl font-bold">{records.length}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">
                  Total recorded maintenance cost
                </p>
                <p className="mt-2 text-3xl font-bold">
                  {formatCurrency(totalSpent, "PHP")}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Select vehicle</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Maintenance history is kept separate for each vehicle.
                </p>
              </div>

              <select
                className={inputClass}
                value={activeVehicleId}
                onChange={(event) => handleVehicleChange(event.target.value)}
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.nickname ||
                      `${vehicle.make} ${vehicle.model}${vehicle.model_year ? ` (${vehicle.model_year})` : ""}`}
                  </option>
                ))}
              </select>

              {selectedVehicle && (
                <p className="mt-3 text-sm text-slate-400">
                  Current odometer:{" "}
                  <span className="font-medium text-slate-200">
                    {selectedVehicle.current_odometer.toLocaleString()}{" "}
                    {selectedVehicle.odometer_unit}
                  </span>
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">
                  {editingId ? "Edit maintenance record" : "Add maintenance record"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Enter the details from your latest service or repair.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Service or repair title *">
                    <input
                      className={inputClass}
                      value={form.title}
                      onChange={(event) => updateForm("title", event.target.value)}
                      placeholder="e.g. Engine oil and filter change"
                      required
                      maxLength={120}
                    />
                  </Field>

                  <Field label="Category">
                    <select
                      className={inputClass}
                      value={form.category}
                      onChange={(event) =>
                        updateForm("category", event.target.value)
                      }
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {formatCategory(category)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Service date *">
                    <input
                      className={inputClass}
                      type="date"
                      value={form.service_date}
                      onChange={(event) =>
                        updateForm("service_date", event.target.value)
                      }
                      required
                    />
                  </Field>

                  <Field
                    label={`Odometer (${selectedVehicle?.odometer_unit ?? "km"})`}
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
                    />
                  </Field>

                  <Field label="Total cost (PHP) *">
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.cost}
                      onChange={(event) => updateForm("cost", event.target.value)}
                      required
                    />
                  </Field>

                  <Field label="Workshop / service provider">
                    <input
                      className={inputClass}
                      value={form.shop_name}
                      onChange={(event) =>
                        updateForm("shop_name", event.target.value)
                      }
                      placeholder="e.g. Local mechanic"
                      maxLength={120}
                    />
                  </Field>
                </div>

                <Field label="Description / notes">
                  <textarea
                    className={inputClass}
                    rows={4}
                    value={form.description}
                    onChange={(event) =>
                      updateForm("description", event.target.value)
                    }
                    placeholder="Parts replaced, work performed, or other notes..."
                    maxLength={3000}
                  />
                </Field>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saveMutation.isPending
                      ? "Saving..."
                      : editingId
                        ? "Save Changes"
                        : "Add Record"}
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">Service history</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedVehicle?.nickname ||
                      `${selectedVehicle?.make ?? ""} ${selectedVehicle?.model ?? ""}`}
                  </p>
                </div>

                {recordsError && (
                  <button
                    type="button"
                    onClick={() => void refetchRecords()}
                    disabled={fetchingRecords}
                    className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {fetchingRecords ? "Retrying..." : "Retry loading records"}
                  </button>
                )}
              </div>

              {recordsError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
                >
                  Unable to load maintenance records: {recordsError.message}
                </div>
              )}

              {loading ? (
                <p className="py-8 text-slate-400">
                  Loading maintenance records...
                </p>
              ) : records.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
                  <h3 className="font-semibold">No maintenance records yet</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Add your first service record using the form above.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {records.map((record) => (
                    <article
                      key={record.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold">
                              {record.title}
                            </h3>
                            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                              {formatCategory(record.category)}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-400">
                            {new Date(
                              `${record.service_date}T00:00:00`,
                            ).toLocaleDateString("en-PH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                            {record.odometer !== null &&
                              ` · ${record.odometer.toLocaleString()} ${selectedVehicle?.odometer_unit ?? "km"}`}
                          </p>

                          {record.shop_name && (
                            <p className="mt-2 text-sm text-slate-300">
                              Workshop: {record.shop_name}
                            </p>
                          )}

                          {record.description && (
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                              {record.description}
                            </p>
                          )}
                        </div>

                        <div className="sm:text-right">
                          <p className="text-xl font-bold text-emerald-400">
                            {formatCurrency(Number(record.cost), record.currency)}
                          </p>

                          <div className="mt-4 flex gap-2 sm:justify-end">
                            <button
                              type="button"
                              onClick={() => startEditing(record)}
                              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(record)}
                              disabled={deleteMutation.isPending}
                              className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deleteMutation.isPending &&
                              deleteMutation.variables?.id === record.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
