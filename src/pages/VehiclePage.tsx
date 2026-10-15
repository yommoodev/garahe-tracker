
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

type Vehicle = {
  id: string;
  nickname: string | null;
  make: string;
  model: string;
  model_year: number | null;
  trim: string | null;
  color: string | null;
  license_plate: string | null;
  vin: string | null;
  current_odometer: number;
  odometer_unit: string;
  created_at: string;
};

const emptyForm = {
  nickname: "",
  make: "",
  model: "",
  model_year: "",
  trim: "",
  color: "",
  license_plate: "",
  vin: "",
  current_odometer: "0",
  odometer_unit: "km",
};

type VehicleForm = typeof emptyForm;

async function getVehicles(userId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select(
      "id, nickname, make, model, model_year, trim, color, license_plate, vin, current_odometer, odometer_unit, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as Vehicle[];
}

export default function VehiclesPage() {
  const queryClient = useQueryClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [form, setForm] = useState<VehicleForm>({ ...emptyForm });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const { data, error: authError } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !data.user) {
        setError("Your session could not be verified. Please sign in again.");
        setUserId(null);
      } else {
        setUserId(data.user.id);
      }

      setAuthLoading(false);
    }

    void loadUser();

    return () => {
      active = false;
    };
  }, []);

  const vehiclesQuery = useQuery({
    queryKey: ["vehicles", userId],
    queryFn: () => getVehicles(userId!),
    enabled: Boolean(userId),
  });

  const vehicles = vehiclesQuery.data ?? [];

  const addVehicleMutation = useMutation({
    mutationFn: async (values: VehicleForm) => {
      if (!userId) throw new Error("Please sign in again.");

      const { error: insertError } = await supabase
        .from("vehicles")
        .insert({
          user_id: userId,
          nickname: values.nickname.trim() || null,
          make: values.make.trim(),
          model: values.model.trim(),
          model_year: values.model_year.trim()
            ? Number(values.model_year)
            : null,
          trim: values.trim.trim() || null,
          color: values.color.trim() || null,
          license_plate: values.license_plate.trim() || null,
          vin: values.vin.trim() || null,
          current_odometer: Number(values.current_odometer),
          odometer_unit: values.odometer_unit,
        });

      if (insertError) throw insertError;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["vehicles", userId],
      });

      setForm({ ...emptyForm });
      setSuccess("Vehicle added successfully.");
      setError("");
    },
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : "Unable to add vehicle.",
      );
    },
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicle: Vehicle) => {
      const { error: deleteError } = await supabase
        .from("vehicles")
        .delete()
        .eq("id", vehicle.id)
        .eq("user_id", userId!);

      if (deleteError) throw deleteError;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["vehicles", userId],
      });

      setSuccess("Vehicle deleted.");
      setError("");
    },
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : "Unable to delete vehicle.",
      );
    },
  });

  function updateField(field: keyof VehicleForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const make = form.make.trim();
    const model = form.model.trim();
    const yearText = form.model_year.trim();
    const odometer = Number(form.current_odometer);

    if (!make || !model) {
      setError("Make and model are required.");
      return;
    }

    if (
      yearText &&
      (!Number.isInteger(Number(yearText)) ||
        Number(yearText) < 1886 ||
        Number(yearText) > new Date().getFullYear() + 1)
    ) {
      setError("Enter a valid model year.");
      return;
    }

    if (
      !Number.isFinite(odometer) ||
      odometer < 0 ||
      !Number.isInteger(odometer)
    ) {
      setError("Enter a valid non-negative odometer reading.");
      return;
    }

    try {
      await addVehicleMutation.mutateAsync({ ...form });
    } catch {
      // The mutation's onError callback displays the error.
    }
  }

  async function handleDelete(vehicle: Vehicle) {
    const name = vehicle.nickname || `${vehicle.make} ${vehicle.model}`;

    const confirmed = window.confirm(
      `Delete ${name}? Its associated maintenance, fuel logs, and reminders may also be deleted.`,
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await deleteVehicleMutation.mutateAsync(vehicle);
    } catch {
      // The mutation's onError callback displays the error.
    }
  }

  const loading = authLoading || vehiclesQuery.isPending;
  const saving = addVehicleMutation.isPending;
  const deleting = deleteVehicleMutation.isPending;

  return (
    <main className="min-h-screen bg-[#0b0d10] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-400">
            GarageLog / Garage
          </p>
          <h1 className="mt-2 text-3xl font-bold">My Vehicles</h1>
          <p className="mt-2 text-sm text-gray-400">
            Manage your garage and track your vehicles.
          </p>
        </header>

        {(error || vehiclesQuery.error) && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
          >
            {error ||
              (vehiclesQuery.error instanceof Error
                ? vehiclesQuery.error.message
                : "Unable to load vehicles.")}
          </p>
        )}

        {success && (
          <p
            role="status"
            className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300"
          >
            {success}
          </p>
        )}

        <section className="rounded-2xl border border-white/10 bg-[#14181e] p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Add a vehicle</h2>
          <p className="mt-1 text-sm text-gray-400">
            Fields marked * are required.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Make *">
                <input
                  required
                  value={form.make}
                  onChange={(e) => updateField("make", e.target.value)}
                  placeholder="e.g. Suzuki"
                  className={inputClass}
                />
              </Field>

              <Field label="Model *">
                <input
                  required
                  value={form.model}
                  onChange={(e) => updateField("model", e.target.value)}
                  placeholder="e.g. Swift"
                  className={inputClass}
                />
              </Field>

              <Field label="Model year">
                <input
                  type="number"
                  min="1886"
                  max={new Date().getFullYear() + 1}
                  value={form.model_year}
                  onChange={(e) => updateField("model_year", e.target.value)}
                  placeholder="e.g. 2011"
                  className={inputClass}
                />
              </Field>

              <Field label="Nickname">
                <input
                  value={form.nickname}
                  onChange={(e) => updateField("nickname", e.target.value)}
                  placeholder="e.g. Daily Driver"
                  className={inputClass}
                />
              </Field>

              <Field label="Trim">
                <input
                  value={form.trim}
                  onChange={(e) => updateField("trim", e.target.value)}
                  placeholder="e.g. 1.4 GL"
                  className={inputClass}
                />
              </Field>

              <Field label="Color">
                <input
                  value={form.color}
                  onChange={(e) => updateField("color", e.target.value)}
                  placeholder="e.g. White"
                  className={inputClass}
                />
              </Field>

              <Field label="License plate">
                <input
                  value={form.license_plate}
                  onChange={(e) => updateField("license_plate", e.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                />
              </Field>

              <Field label="VIN">
                <input
                  value={form.vin}
                  onChange={(e) => updateField("vin", e.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                />
              </Field>

              <Field label="Current odometer *">
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={form.current_odometer}
                  onChange={(e) =>
                    updateField("current_odometer", e.target.value)
                  }
                  className={inputClass}
                />
              </Field>

              <Field label="Odometer unit">
                <select
                  value={form.odometer_unit}
                  onChange={(e) =>
                    updateField("odometer_unit", e.target.value)
                  }
                  className={inputClass}
                >
                  <option value="km">Kilometers (km)</option>
                  <option value="mi">Miles (mi)</option>
                </select>
              </Field>
            </div>

            <button
              type="submit"
              disabled={saving || !userId}
              className="rounded-lg bg-orange-500 px-5 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Add Vehicle"}
            </button>
          </form>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your garage</h2>
            <span className="text-sm text-gray-400">
              {vehicles.length}{" "}
              {vehicles.length === 1 ? "vehicle" : "vehicles"}
            </span>
          </div>

          {loading ? (
            <p className="text-gray-400">Loading vehicles...</p>
          ) : vehiclesQuery.isError ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
              <p className="font-medium">Couldn't load your garage</p>
              <button
                type="button"
                onClick={() => void vehiclesQuery.refetch()}
                className="mt-3 rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
              >
                Try again
              </button>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
              <p className="font-medium">Your garage is empty</p>
              <p className="mt-2 text-sm text-gray-400">
                Add your first vehicle using the form above.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {vehicles.map((vehicle) => (
                <article
                  key={vehicle.id}
                  className="rounded-2xl border border-white/10 bg-[#14181e] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-orange-400">
                        {vehicle.nickname || "My vehicle"}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold">
                        {vehicle.model_year ? `${vehicle.model_year} ` : ""}
                        {vehicle.make} {vehicle.model}
                      </h3>
                      {vehicle.trim && (
                        <p className="mt-1 text-sm text-gray-400">
                          {vehicle.trim}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleDelete(vehicle)}
                      disabled={deleting}
                      className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                    <div>
                      <p className="text-xs text-gray-500">Odometer</p>
                      <p className="mt-1 font-medium">
                        {vehicle.current_odometer.toLocaleString()}{" "}
                        {vehicle.odometer_unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Color</p>
                      <p className="mt-1 font-medium">
                        {vehicle.color || "Not specified"}
                      </p>
                    </div>
                  </div>

                  {vehicle.license_plate && (
                    <p className="mt-3 text-sm text-gray-400">
                      Plate: {vehicle.license_plate}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#0b0d10] px-3 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-orange-400";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm text-gray-300">
      <span>{label}</span>
      {children}
    </label>
  );
}
