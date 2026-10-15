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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className='block space-y-2'>
      <span className='text-sm font-medium text-slate-300'>{label}</span>
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

export default function FuelPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [form, setForm] = useState<FuelForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === selectedVehicleId,
  );

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

    const loaded = (data ?? []) as Vehicle[];
    setVehicles(loaded);

    setSelectedVehicleId((currentId) => {
      if (loaded.some((vehicle) => vehicle.id === currentId)) {
        return currentId;
      }
      return loaded[0]?.id ?? "";
    });

    setLoadingVehicles(false);
  }

  async function loadLogs(vehicleId: string) {
    if (!vehicleId) {
      setLogs([]);
      setLoadingLogs(false);
      return;
    }

    setLoadingLogs(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("fuel_logs")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("fill_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setLoadingLogs(false);
      return;
    }

    setLogs((data ?? []) as FuelLog[]);
    setLoadingLogs(false);
  }

  useEffect(() => {
    void loadVehicles();
  }, []);

  useEffect(() => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setSuccess("");
    void loadLogs(selectedVehicleId);
  }, [selectedVehicleId]);

  function updateForm<K extends keyof FuelForm>(field: K, value: FuelForm[K]) {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedVehicleId) {
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Your session could not be verified. Please sign in again.");
      return;
    }

    setSaving(true);

    const totalCost = Math.round(quantity * price * 100) / 100;

    const payload = {
      user_id: user.id,
      vehicle_id: selectedVehicleId,
      fill_date: form.fill_date,
      odometer,
      liters: quantity,
      price_per_liter: price,
      total_cost: totalCost,
      fuel_type: form.fuel_type || null,
      full_tank: form.full_tank,
      notes: form.notes.trim() || null,
    };

    const result = editingId
      ? await supabase
          .from("fuel_logs")
          .update(payload)
          .eq("id", editingId)
          .eq("vehicle_id", selectedVehicleId)
          .select("id")
          .maybeSingle()
      : await supabase.from("fuel_logs").insert(payload).select("id").single();

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    if (!result.data) {
      setError(
        "No fuel log was changed. It may have been deleted or you may not have access to it.",
      );
      setSaving(false);
      return;
    }

    setSuccess(editingId ? "Fuel log updated." : "Fuel log added.");
    setEditingId(null);
    setForm({ ...emptyForm });

    await loadLogs(selectedVehicleId);
    setSaving(false);
  }

  async function handleDelete(log: FuelLog) {
    const confirmed = window.confirm(
      `Delete the fuel log from ${log.fill_date}? This cannot be undone.`,
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("fuel_logs")
      .delete()
      .eq("id", log.id)
      .eq("vehicle_id", selectedVehicleId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingId === log.id) {
      setEditingId(null);
      setForm({ ...emptyForm });
    }

    setSuccess("Fuel log deleted.");
    await loadLogs(selectedVehicleId);
  }

  if (loadingVehicles) {
    return (
      <main className='min-h-screen bg-slate-950 p-6 text-slate-300'>
        Loading your vehicles...
      </main>
    );
  }

  return (
    <main className='min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-10'>
      <div className='mx-auto max-w-7xl space-y-8'>
        <header>
          <p className='text-sm font-semibold uppercase tracking-[0.2em] text-blue-400'>
            GarageLog / Fuel tracking
          </p>
          <h1 className='mt-3 text-3xl font-bold tracking-tight sm:text-4xl'>
            Fuel Logs
          </h1>
          <p className='mt-2 text-slate-400'>
            Track fill-ups, fuel spending, and odometer readings.
          </p>
        </header>

        {error && (
          <div
            role='alert'
            className='rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300'
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role='status'
            className='rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300'
          >
            {success}
          </div>
        )}

        {vehicles.length === 0 ? (
          <section className='rounded-2xl border border-slate-800 bg-slate-900 p-6'>
            <h2 className='text-xl font-semibold'>No vehicles yet</h2>
            <p className='mt-2 text-slate-400'>
              Add a vehicle before recording fuel fill-ups.
            </p>
            <a
              href='/vehicles'
              className='mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold hover:bg-blue-500'
            >
              Go to Vehicles
            </a>
          </section>
        ) : (
          <>
            <section className='grid gap-4 sm:grid-cols-2'>
              <div className='rounded-2xl border border-slate-800 bg-slate-900 p-5'>
                <p className='text-sm text-slate-400'>Fuel fill-ups recorded</p>
                <p className='mt-2 text-3xl font-bold'>{logs.length}</p>
              </div>
              <div className='rounded-2xl border border-slate-800 bg-slate-900 p-5'>
                <p className='text-sm text-slate-400'>Total fuel spending</p>
                <p className='mt-2 text-3xl font-bold'>
                  {formatCurrency(totalSpent)}
                </p>
              </div>
            </section>

            <section className='rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6'>
              <h2 className='text-xl font-semibold'>Select vehicle</h2>
              <p className='mb-4 mt-1 text-sm text-slate-400'>
                Fuel logs are displayed separately for each vehicle.
              </p>

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
                <p className='mt-3 text-sm text-slate-400'>
                  Current odometer:{" "}
                  <span className='font-medium text-slate-200'>
                    {selectedVehicle.current_odometer.toLocaleString()}{" "}
                    {selectedVehicle.odometer_unit}
                  </span>
                </p>
              )}
            </section>

            <section className='rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6'>
              <h2 className='text-xl font-semibold'>
                {editingId ? "Edit fuel log" : "Record a fill-up"}
              </h2>
              <p className='mb-6 mt-1 text-sm text-slate-400'>
                Enter the details from your fuel receipt.
              </p>

              <form onSubmit={handleSubmit} className='space-y-5'>
                <div className='grid gap-5 sm:grid-cols-2'>
                  <Field label='Fill-up date *'>
                    <input
                      className={inputClass}
                      type='date'
                      value={form.fill_date}
                      onChange={(event) =>
                        updateForm("fill_date", event.target.value)
                      }
                      required
                    />
                  </Field>

                  <Field
                    label={`Odometer (${selectedVehicle?.odometer_unit ?? "km"}) *`}
                  >
                    <input
                      className={inputClass}
                      type='number'
                      min='0'
                      step='1'
                      value={form.odometer}
                      onChange={(event) =>
                        updateForm("odometer", event.target.value)
                      }
                      placeholder='e.g. 120000'
                      required
                    />
                  </Field>

                  <Field label='Fuel quantity (liters) *'>
                    <input
                      className={inputClass}
                      type='number'
                      min='0.01'
                      step='0.01'
                      value={form.liters}
                      onChange={(event) =>
                        updateForm("liters", event.target.value)
                      }
                      placeholder='e.g. 35.50'
                      required
                    />
                  </Field>

                  <Field label='Price per liter (PHP) *'>
                    <input
                      className={inputClass}
                      type='number'
                      min='0.01'
                      step='0.01'
                      value={form.price_per_liter}
                      onChange={(event) =>
                        updateForm("price_per_liter", event.target.value)
                      }
                      placeholder='e.g. 62.50'
                      required
                    />
                  </Field>

                  <Field label='Fuel type'>
                    <select
                      className={inputClass}
                      value={form.fuel_type}
                      onChange={(event) =>
                        updateForm("fuel_type", event.target.value)
                      }
                    >
                      <option value='Gasoline'>Gasoline</option>
                      <option value='Diesel'>Diesel</option>
                      <option value='Premium gasoline'>Premium gasoline</option>
                      <option value='Regular gasoline'>Regular gasoline</option>
                      <option value='Other'>Other</option>
                    </select>
                  </Field>

                  <div className='rounded-xl border border-slate-700 bg-slate-950 p-4'>
                    <p className='text-sm text-slate-400'>Calculated total</p>
                    <p className='mt-2 text-2xl font-bold text-emerald-400'>
                      {formatCurrency(calculatedCost)}
                    </p>
                    <p className='mt-1 text-xs text-slate-500'>
                      Liters × price per liter
                    </p>
                  </div>
                </div>

                <label className='flex items-start gap-3 rounded-xl border border-slate-700 p-4'>
                  <input
                    type='checkbox'
                    checked={form.full_tank}
                    onChange={(event) =>
                      updateForm("full_tank", event.target.checked)
                    }
                    className='mt-1 h-4 w-4 accent-blue-500'
                  />
                  <span>
                    <span className='block text-sm font-medium text-slate-200'>
                      Full tank
                    </span>
                    <span className='mt-1 block text-sm text-slate-400'>
                      Check this if you filled the tank completely. This helps
                      calculate fuel economy more reliably later.
                    </span>
                  </span>
                </label>

                <Field label='Notes (optional)'>
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={form.notes}
                    onChange={(event) =>
                      updateForm("notes", event.target.value)
                    }
                    placeholder='Fuel station, receipt details, or other notes...'
                    maxLength={2000}
                  />
                </Field>

                <div className='flex flex-wrap gap-3'>
                  <button
                    type='submit'
                    disabled={saving}
                    className='rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    {saving
                      ? "Saving..."
                      : editingId
                        ? "Save Changes"
                        : "Add Fuel Log"}
                  </button>

                  {editingId && (
                    <button
                      type='button'
                      onClick={cancelEditing}
                      className='rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800'
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className='space-y-4'>
              <div>
                <h2 className='text-2xl font-bold'>Fuel history</h2>
                <p className='mt-1 text-sm text-slate-400'>
                  {selectedVehicle?.nickname ||
                    `${selectedVehicle?.make ?? ""} ${selectedVehicle?.model ?? ""}`}
                </p>
              </div>

              {loadingLogs ? (
                <p className='py-8 text-slate-400'>Loading fuel logs...</p>
              ) : logs.length === 0 ? (
                <div className='rounded-2xl border border-dashed border-slate-700 p-8 text-center'>
                  <h3 className='font-semibold'>No fuel logs yet</h3>
                  <p className='mt-2 text-sm text-slate-400'>
                    Add your first fill-up using the form above.
                  </p>
                </div>
              ) : (
                <div className='space-y-4'>
                  {logs.map((log) => (
                    <article
                      key={log.id}
                      className='rounded-2xl border border-slate-800 bg-slate-900 p-5'
                    >
                      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
                        <div className='min-w-0 flex-1'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <h3 className='text-lg font-semibold'>
                              {log.fuel_type || "Fuel fill-up"}
                            </h3>
                            <span className='rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300'>
                              {log.full_tank ? "Full tank" : "Partial fill"}
                            </span>
                          </div>

                          <p className='mt-2 text-sm text-slate-400'>
                            {new Date(
                              `${log.fill_date}T00:00:00`,
                            ).toLocaleDateString("en-PH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                            {" · "}
                            {log.odometer.toLocaleString()}{" "}
                            {selectedVehicle?.odometer_unit ?? "km"}
                          </p>

                          <div className='mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3'>
                            <div>
                              <p className='text-slate-500'>Fuel volume</p>
                              <p className='mt-1 font-medium'>
                                {Number(log.liters).toFixed(2)} L
                              </p>
                            </div>
                            <div>
                              <p className='text-slate-500'>Price per liter</p>
                              <p className='mt-1 font-medium'>
                                {formatCurrency(Number(log.price_per_liter))}
                              </p>
                            </div>
                            <div>
                              <p className='text-slate-500'>Total cost</p>
                              <p className='mt-1 font-semibold text-emerald-400'>
                                {formatCurrency(Number(log.total_cost))}
                              </p>
                            </div>
                          </div>

                          {log.notes && (
                            <p className='mt-3 whitespace-pre-wrap text-sm text-slate-400'>
                              {log.notes}
                            </p>
                          )}
                        </div>

                        <div className='flex gap-2 sm:justify-end'>
                          <button
                            type='button'
                            onClick={() => startEditing(log)}
                            className='rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800'
                          >
                            Edit
                          </button>
                          <button
                            type='button'
                            onClick={() => void handleDelete(log)}
                            className='rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10'
                          >
                            Delete
                          </button>
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
