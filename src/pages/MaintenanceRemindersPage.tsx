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

type ReminderPayload = {
  user_id: string;
  vehicle_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_odometer: number | null;
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
    return {
      label: "Completed",
      style:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    };
  }

  const today = getToday();

  const overdueByDate =
    reminder.due_date !== null && reminder.due_date < today;

  if (overdueByDate) {
    return {
      label: "Overdue",
      style: "border-red-500/30 bg-red-500/10 text-red-300",
    };
  }

  const dueByOdometer =
    reminder.due_odometer !== null &&
    currentOdometer >= reminder.due_odometer;

  if (dueByOdometer) {
    return {
      label: "Due by mileage",
      style: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    };
  }

  const dueToday =
    reminder.due_date !== null && reminder.due_date === today;

  if (dueToday) {
    return {
      label: "Due today",
      style: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    };
  }

  return {
    label: "Upcoming",
    style: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  };
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

async function fetchReminders(
  userId: string,
  vehicleId: string,
): Promise<MaintenanceReminder[]> {
  const { data, error } = await supabase
    .from("maintenance_reminders")
    .select("*")
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId)
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) throw error;

  return (data ?? []) as MaintenanceReminder[];
}

export default function MaintenanceRemindersPage() {
  const { session, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? null;

  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [form, setForm] = useState<ReminderForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const vehiclesQuery = useQuery({
    queryKey: ["vehicles", userId],
    queryFn: () => {
      if (!userId) {
        throw new Error("Please sign in to view your vehicles.");
      }

      return fetchVehicles(userId);
    },
    enabled: Boolean(userId),
  });

  const vehicles = vehiclesQuery.data ?? [];

  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === selectedVehicleId,
  );

  const activeVehicleId =
    selectedVehicle?.id ?? vehicles[0]?.id ?? "";

  const activeVehicle = vehicles.find(
    (vehicle) => vehicle.id === activeVehicleId,
  );

  const remindersQuery = useQuery({
    queryKey: ["reminders", userId, activeVehicleId],
    queryFn: () => {
      if (!userId || !activeVehicleId) {
        throw new Error("Select a vehicle to view its reminders.");
      }

      return fetchReminders(userId, activeVehicleId);
    },
    enabled: Boolean(userId && activeVehicleId),
  });

  const reminders = remindersQuery.data ?? [];

  const activeCount = reminders.filter(
    (reminder) => !reminder.completed_at,
  ).length;

  const completedCount = reminders.filter(
    (reminder) => Boolean(reminder.completed_at),
  ).length;

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
      payload: ReminderPayload;
      recordId: string | null;
      vehicleId: string;
    }) => {
      if (recordId) {
        const { data, error: updateError } = await supabase
          .from("maintenance_reminders")
          .update(payload)
          .eq("id", recordId)
          .eq("user_id", payload.user_id)
          .eq("vehicle_id", vehicleId)
          .select("id")
          .maybeSingle();

        if (updateError) throw updateError;

        if (!data) {
          throw new Error(
            "No reminder was changed. It may have been deleted or you may not have access to it.",
          );
        }

        return { wasEditing: true };
      }

      const { data, error: insertError } = await supabase
        .from("maintenance_reminders")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) throw insertError;
      if (!data) throw new Error("The reminder could not be created.");

      return { wasEditing: false };
    },
    onSuccess: async (result) => {
      setSuccess(
        result.wasEditing ? "Reminder updated." : "Reminder created.",
      );
      setError("");
      setEditingId(null);
      setForm({ ...emptyForm });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["reminders", userId],
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
      setError(mutationError.message || "Unable to save the reminder.");
    },
  });

  const completionMutation = useMutation({
    mutationFn: async (reminder: MaintenanceReminder) => {
      if (!userId) {
        throw new Error(
          "Your session could not be verified. Please sign in again.",
        );
      }

      const completedAt = reminder.completed_at
        ? null
        : new Date().toISOString();

      const { data, error: updateError } = await supabase
        .from("maintenance_reminders")
        .update({ completed_at: completedAt })
        .eq("id", reminder.id)
        .eq("user_id", userId)
        .eq("vehicle_id", reminder.vehicle_id)
        .select("id")
        .maybeSingle();

      if (updateError) throw updateError;

      if (!data) {
        throw new Error(
          "The reminder could not be updated. Please refresh and try again.",
        );
      }

      return { completed: Boolean(completedAt) };
    },
    onSuccess: async (result) => {
      setError("");
      setSuccess(
        result.completed
          ? "Reminder marked as completed."
          : "Reminder reopened.",
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["reminders", userId],
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
      setError(mutationError.message || "Unable to update the reminder.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (reminder: MaintenanceReminder) => {
      if (!userId) {
        throw new Error(
          "Your session could not be verified. Please sign in again.",
        );
      }

      const { data, error: deleteError } = await supabase
        .from("maintenance_reminders")
        .delete()
        .eq("id", reminder.id)
        .eq("user_id", userId)
        .eq("vehicle_id", reminder.vehicle_id)
        .select("id")
        .maybeSingle();

      if (deleteError) throw deleteError;

      if (!data) {
        throw new Error(
          "No reminder was deleted. It may already have been removed or you may not have access to it.",
        );
      }

      return reminder.id;
    },
    onSuccess: async (deletedId) => {
      if (editingId === deletedId) {
        setEditingId(null);
        setForm({ ...emptyForm });
      }

      setError("");
      setSuccess("Reminder deleted.");

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["reminders", userId],
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
      setError(mutationError.message || "Unable to delete the reminder.");
    },
  });

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!userId) {
      setError("Your session could not be verified. Please sign in again.");
      return;
    }

    if (!activeVehicleId) {
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

    if (
      hasDueDate &&
      !/^\d{4}-\d{2}-\d{2}$/.test(form.due_date)
    ) {
      setError("Enter a valid due date.");
      return;
    }

    const payload: ReminderPayload = {
      user_id: userId,
      vehicle_id: activeVehicleId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      due_date: hasDueDate ? form.due_date : null,
      due_odometer: dueOdometer,
    };

    saveMutation.mutate({
      payload,
      recordId: editingId,
      vehicleId: activeVehicleId,
    });
  }

  function handleDelete(reminder: MaintenanceReminder) {
    const confirmed = window.confirm(
      `Delete the reminder "${reminder.title}"? This cannot be undone.`,
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    deleteMutation.mutate(reminder);
  }

  const isMutating =
    saveMutation.isPending ||
    completionMutation.isPending ||
    deleteMutation.isPending;

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
            Garahe Tracker / Stay on schedule
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Maintenance Reminders
          </h1>
          <p className="mt-2 text-slate-400">
            Plan your next service by date, mileage, or both.
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

        {!userId || vehiclesQuery.isError ? null : vehicles.length === 0 ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">No vehicles yet</h2>
            <p className="mt-2 text-slate-400">
              Add a vehicle before creating maintenance reminders.
            </p>
            <Link
              to="/vehicles"
              className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold hover:bg-blue-500"
            >
              Go to Vehicles
            </Link>
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
                    onChange={(event) =>
                      updateForm("title", event.target.value)
                    }
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
                      onChange={(event) =>
                        updateForm("due_date", event.target.value)
                      }
                    />
                  </Field>

                  <Field
                    label={`Due odometer (${activeVehicle?.odometer_unit ?? "km"}, optional)`}
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
                    disabled={isMutating}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saveMutation.isPending
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
                  {activeVehicle?.nickname ||
                    `${activeVehicle?.make ?? ""} ${activeVehicle?.model ?? ""}`}
                </p>
              </div>

              {remindersQuery.isPending ? (
                <p className="py-8 text-slate-400">Loading reminders...</p>
              ) : remindersQuery.isError ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300"
                >
                  <p>
                    Could not load reminders: {remindersQuery.error.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => void remindersQuery.refetch()}
                    className="mt-3 rounded-lg border border-red-400/30 px-3 py-2 font-semibold hover:bg-red-500/10"
                  >
                    Retry
                  </button>
                </div>
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
                      activeVehicle?.current_odometer ?? 0,
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
                                <p>
                                  Due date: {formatDate(reminder.due_date)}
                                </p>
                              )}

                              {reminder.due_odometer !== null && (
                                <p>
                                  Due at:{" "}
                                  {reminder.due_odometer.toLocaleString()}{" "}
                                  {activeVehicle?.odometer_unit ?? "km"}
                                </p>
                              )}

                              {reminder.completed_at && (
                                <p>
                                  Completed on:{" "}
                                  {new Date(
                                    reminder.completed_at,
                                  ).toLocaleDateString("en-PH", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })}
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
                              onClick={() =>
                                completionMutation.mutate(reminder)
                              }
                              disabled={isMutating}
                              className="rounded-lg border border-emerald-500/30 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                            >
                              {completionMutation.isPending
                                ? "Updating..."
                                : reminder.completed_at
                                  ? "Reopen"
                                  : "Complete"}
                            </button>

                            <button
                              type="button"
                              onClick={() => startEditing(reminder)}
                              disabled={isMutating}
                              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(reminder)}
                              disabled={isMutating}
                              className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                            >
                              {deleteMutation.isPending
                                ? "Deleting..."
                                : "Delete"}
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
