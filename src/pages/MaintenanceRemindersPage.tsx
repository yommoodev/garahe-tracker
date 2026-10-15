
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

type MaintenanceReminder = {
  id: string;
  user_id: string;
  vehicle_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_odometer: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ReminderForm = {
  title: string;
  description: string;
  due_date: string;
  due_odometer: string;
};

function getToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const emptyForm: ReminderForm = {
  title: "",
  description: "",
  due_date: "",
  due_odometer: "",
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

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getReminderStatus(
  reminder: MaintenanceReminder,
  currentOdometer: number,
) {
  if (reminder.completed_at) {
    return { label: "Completed", style: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" };
  }

  const overdueByDate =
    reminder.due_date !== null && reminder.due_date < getToday();

  if (overdueByDate) {
    return { label: "Overdue", style: "border-red-500/30 bg-red-500/10 text-red-300" };
  }

  const dueByOdometer =
    reminder.due_odometer !== null &&
    currentOdometer >= reminder.due_odometer;

  if (dueByOdometer) {
    return { label: "Due by mileage", style: "border-amber-500/30 bg-amber-500/10 text-amber-300" };
  }

  const dueToday =
    reminder.due_date !== null && reminder.due_date === getToday();

  if (dueToday) {
    return { label: "Due today", style: "border-amber-500/30 bg-amber-500/10 text-amber-300" };
  }

  return { label: "Upcoming", style: "border-blue-500/30 bg-blue-500/10 text-blue-300" };
}

export default function MaintenanceRemindersPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([]);
  const [form, setForm] = useState<ReminderForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === selectedVehicleId,
  );

  const activeCount = reminders.filter(
    (reminder) => !reminder.completed_at,
  ).length;

  const completedCount = reminders.filter(
    (reminder) => Boolean(reminder.completed_at),
  ).length;

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

  async function loadReminders(vehicleId: string) {
    if (!vehicleId) {
      setReminders([]);
      setLoadingReminders(false);
      return;
    }

    setLoadingReminders(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("maintenance_reminders")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("completed_at", { ascending: true, nullsFirst: true })
      .order("due_date", { ascending: true, nullsFirst: false });

    if (queryError) {
      setError(queryError.message);
      setLoadingReminders(false);
      return;
    }

    setReminders((data ?? []) as MaintenanceReminder[]);
    setLoadingReminders(false);
  }

  useEffect(() => {
    void loadVehicles();
  }, []);

  useEffect(() => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setSuccess("");
    void loadReminders(selectedVehicleId);
  }, [selectedVehicleId]);

  function updateForm<K extends keyof ReminderForm>(
    field: K,
    value: ReminderForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEditing(reminder: MaintenanceReminder) {
    setEditingId(reminder.id);
    setForm({
      title: reminder.title,
      description: reminder.description ?? "",
      due_date: reminder.due_date ?? "",
      due_odometer:
        reminder.due_odometer === null
          ? ""
          : String(reminder.due_odometer),
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
      setError("Add a vehicle before creating a reminder.");
      return;
    }

    if (!form.title.trim()) {
      setError("Enter a reminder title.");
      return;
    }

    const hasDueDate = Boolean(form.due_date);
    const hasDueOdometer = form.due_odometer.trim() !== "";

    if (!hasDueDate && !hasDueOdometer) {
      setError("Enter a due date, a due odometer, or both.");
      return;
    }

    let dueOdometer: number | null = null;

    if (hasDueOdometer) {
      dueOdometer = Number(form.due_odometer);

      if (!Number.isInteger(dueOdometer) || dueOdometer < 0) {
        setError("Due odometer must be a non-negative whole number.");
        return;
      }
    }

    if (hasDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.due_date)) {
      setError("Enter a valid due date.");
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
      description: form.description.trim() || null,
      due_date: hasDueDate ? form.due_date : null,
      due_odometer: dueOdometer,
    };

    const result = editingId
      ? await supabase
          .from("maintenance_reminders")
          .update(payload)
          .eq("id", editingId)
          .eq("vehicle_id", selectedVehicleId)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("maintenance_reminders")
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
        "No reminder was changed. It may have been deleted or you may not have access to it.",
      );
      setSaving(false);
      return;
    }

    setSuccess(editingId ? "Reminder updated." : "Reminder created.");
    setEditingId(null);
    setForm({ ...emptyForm });

    await loadReminders(selectedVehicleId);
    setSaving(false);
  }

  async function toggleCompleted(reminder: MaintenanceReminder) {
    setError("");
    setSuccess("");

    const completedAt = reminder.completed_at ? null : new Date().toISOString();

    const { data, error: updateError } = await supabase
      .from("maintenance_reminders")
      .update({ completed_at: completedAt })
      .eq("id", reminder.id)
      .eq("vehicle_id", selectedVehicleId)
      .select("id")
      .maybeSingle();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (!data) {
      setError("The reminder could not be updated. Please refresh and try again.");
      return;
    }

    setSuccess(
      completedAt ? "Reminder marked as completed." : "Reminder reopened.",
    );

    await loadReminders(selectedVehicleId);
  }

  async function handleDelete(reminder: MaintenanceReminder) {
    const confirmed = window.confirm(
      `Delete the reminder "${reminder.title}"? This cannot be undone.`,
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("maintenance_reminders")
      .delete()
      .eq("id", reminder.id)
      .eq("vehicle_id", selectedVehicleId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingId === reminder.id) {
      setEditingId(null);
      setForm({ ...emptyForm });
    }

    setSuccess("Reminder deleted.");
    await loadReminders(selectedVehicleId);
  }

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
            GarageLog / Stay on schedule
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Maintenance Reminders
          </h1>
          <p className="mt-2 text-slate-400">
            Plan your next service by date, mileage, or both.
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
              Add a vehicle before creating maintenance reminders.
            </p>
            <a
              href="/vehicles"
              className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold hover:bg-blue-500"
            >
              Go to Vehicles
            </a>
          </section>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Total reminders</p>
                <p className="mt-2 text-3xl font-bold">{reminders.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Active</p>
                <p className="mt-2 text-3xl font-bold">{activeCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Completed</p>
                <p className="mt-2 text-3xl font-bold">{completedCount}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <h2 className="text-xl font-semibold">Select vehicle</h2>
              <p className="mb-4 mt-1 text-sm text-slate-400">
                Each vehicle has its own reminder list.
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
              <h2 className="text-xl font-semibold">
                {editingId ? "Edit reminder" : "Create reminder"}
              </h2>
              <p className="mb-6 mt-1 text-sm text-slate-400">
                Set a deadline, a mileage target, or both.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <Field label="Reminder title *">
                  <input
                    className={inputClass}
                    value={form.title}
                    onChange={(event) => updateForm("title", event.target.value)}
                    placeholder="e.g. Change engine oil"
                    maxLength={120}
                    required
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Due date (optional)">
                    <input
                      className={inputClass}
                      type="date"
                      value={form.due_date}
                      onChange={(event) => updateForm("due_date", event.target.value)}
                    />
                  </Field>

                  <Field
                    label={`Due odometer (${selectedVehicle?.odometer_unit ?? "km"}, optional)`}
                  >
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="1"
                      value={form.due_odometer}
                      onChange={(event) =>
                        updateForm("due_odometer", event.target.value)
                      }
                      placeholder="e.g. 125000"
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
                    placeholder="Parts, service intervals, or other details..."
                    maxLength={3000}
                  />
                </Field>

                <p className="text-xs text-slate-500">
                  At least one due date or due odometer value is required.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : editingId
                        ? "Save Changes"
                        : "Create Reminder"}
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
                <h2 className="text-2xl font-bold">Your reminders</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedVehicle?.nickname ||
                    `${selectedVehicle?.make ?? ""} ${selectedVehicle?.model ?? ""}`}
                </p>
              </div>

              {loadingReminders ? (
                <p className="py-8 text-slate-400">Loading reminders...</p>
              ) : reminders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
                  <h3 className="font-semibold">No reminders yet</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Create a reminder to plan your next maintenance task.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reminders.map((reminder) => {
                    const status = getReminderStatus(
                      reminder,
                      selectedVehicle?.current_odometer ?? 0,
                    );

                    return (
                      <article
                        key={reminder.id}
                        className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3
                                className={`text-lg font-semibold ${
                                  reminder.completed_at
                                    ? "text-slate-400 line-through"
                                    : "text-white"
                                }`}
                              >
                                {reminder.title}
                              </h3>

                              <span
                                className={`rounded-full border px-3 py-1 text-xs ${status.style}`}
                              >
                                {status.label}
                              </span>
                            </div>

                            <div className="mt-3 space-y-2 text-sm text-slate-400">
                              {reminder.due_date && (
                                <p>Due date: {formatDate(reminder.due_date)}</p>
                              )}

                              {reminder.due_odometer !== null && (
                                <p>
                                  Due at: {reminder.due_odometer.toLocaleString()}{" "}
                                  {selectedVehicle?.odometer_unit ?? "km"}
                                </p>
                              )}

                              {reminder.completed_at && (
                                <p>
                                  Completed on:{" "}
                                  {new Date(reminder.completed_at).toLocaleDateString(
                                    "en-PH",
                                    {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    },
                                  )}
                                </p>
                              )}
                            </div>

                            {reminder.description && (
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                                {reminder.description}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void toggleCompleted(reminder)}
                              className="rounded-lg border border-emerald-500/30 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10"
                            >
                              {reminder.completed_at ? "Reopen" : "Complete"}
                            </button>

                            <button
                              type="button"
                              onClick={() => startEditing(reminder)}
                              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleDelete(reminder)}
                              className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
