
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
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

const emptyForm: MaintenanceForm = {
  title: "",
  category: "other",
  description: "",
  service_date: getToday(),
  odometer: "",
  cost: "0",
  shop_name: "",
};

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

export default function MaintenancePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [form, setForm] = useState<MaintenanceForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === selectedVehicleId,
  );

  async function loadVehicles() {
    setLoadingVehicles(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("vehicles")
      .select(
        "id, make, model, model_year, nickname, current_odometer, odometer_unit",
      )
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setLoadingVehicles(false);
      return;
    }

    const loadedVehicles = (data ?? []) as Vehicle[];
    setVehicles(loadedVehicles);

    setSelectedVehicleId((currentId) => {
      if (loadedVehicles.some((vehicle) => vehicle.id === currentId)) {
        return currentId;
      }

      return loadedVehicles[0]?.id ?? "";
    });

    setLoadingVehicles(false);
  }

  async function loadRecords(vehicleId: string) {
    if (!vehicleId) {
      setRecords([]);
      return;
    }

    setLoadingRecords(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("maintenance_records")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("service_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setLoadingRecords(false);
      return;
    }

    setRecords((data ?? []) as MaintenanceRecord[]);
    setLoadingRecords(false);
  }

  useEffect(() => {
    void loadVehicles();
  }, []);

  useEffect(() => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setSuccess("");
    void loadRecords(selectedVehicleId);
  }, [selectedVehicleId]);

  function updateForm<K extends keyof MaintenanceForm>(
    field: K,
    value: MaintenanceForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
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
    setForm({ ...emptyForm });
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedVehicleId) {
      setError("Add a vehicle before creating a maintenance record.");
      return;
    }

    if (!form.title.trim()) {
      setError("Enter a service or repair title.");
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Your session could not be verified. Please sign in again.");
      return;
    }

    setSaving(true);

    const payload = {
      user_id: user.id,
      vehicle_id: selectedVehicleId,
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim() || null,
      service_date: form.service_date,
      odometer,
      cost,
      currency: "PHP",
      shop_name: form.shop_name.trim() || null,
    };

    const result = editingId
      ? await supabase
          .from("maintenance_records")
          .update(payload)
          .eq("id", editingId)
          .eq("vehicle_id", selectedVehicleId)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("maintenance_records")
          .insert(payload)
          .select("id")
          .single();

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    if (!result.data) {
      setError(
        "No record was changed. It may have been deleted or you may not have access to it.",
      );
      setSaving(false);
      return;
    }

    setSuccess(editingId ? "Maintenance record updated." : "Maintenance record added.");
    setEditingId(null);
    setForm({ ...emptyForm });

    await loadRecords(selectedVehicleId);
    setSaving(false);
  }

  async function handleDelete(record: MaintenanceRecord) {
    const confirmed = window.confirm(
      `Delete "${record.title}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("maintenance_records")
      .delete()
      .eq("id", record.id)
      .eq("vehicle_id", selectedVehicleId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingId === record.id) {
      setEditingId(null);
      setForm({ ...emptyForm });
    }

    setSuccess("Maintenance record deleted.");
    await loadRecords(selectedVehicleId);
  }

  const totalSpent = records.reduce(
    (total, record) => total + Number(record.cost || 0),
    0,
  );

  if (loadingVehicles) {
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
            <a
              href="/vehicles"
              className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Go to Vehicles
            </a>
          </section>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Records for this vehicle</p>
                <p className="mt-2 text-3xl font-bold">{records.length}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Total recorded maintenance cost</p>
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
                value={selectedVehicleId}
                onChange={(event) => setSelectedVehicleId(event.target.value)}
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
                      onChange={(event) => updateForm("category", event.target.value)}
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
                      onChange={(event) => updateForm("service_date", event.target.value)}
                      required
                    />
                  </Field>

                  <Field label={`Odometer (${selectedVehicle?.odometer_unit ?? "km"})`}>
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="1"
                      value={form.odometer}
                      onChange={(event) => updateForm("odometer", event.target.value)}
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
                      onChange={(event) => updateForm("shop_name", event.target.value)}
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
                    onChange={(event) => updateForm("description", event.target.value)}
                    placeholder="Parts replaced, work performed, or other notes..."
                    maxLength={3000}
                  />
                </Field>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
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
              <div>
                <h2 className="text-2xl font-bold">Service history</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedVehicle?.nickname ||
                    `${selectedVehicle?.make ?? ""} ${selectedVehicle?.model ?? ""}`}
                </p>
              </div>

              {loadingRecords ? (
                <p className="py-8 text-slate-400">Loading maintenance records...</p>
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
                            <h3 className="text-lg font-semibold">{record.title}</h3>
                            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                              {formatCategory(record.category)}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-400">
                            {new Date(`${record.service_date}T00:00:00`).toLocaleDateString(
                              "en-PH",
                              { year: "numeric", month: "short", day: "numeric" },
                            )}
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
                              onClick={() => void handleDelete(record)}
                              className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
                            >
                              Delete
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
