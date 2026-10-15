
import {  useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, CarFront, Gauge, Wrench } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../AuthContext";

export default function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (session) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setSubmitting(true);

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() },
          },
        });

        if (error) throw error;

        if (data.session) {
          navigate("/", { replace: true });
        } else {
          setMessage(
            "Account created. Check your email to confirm your account before signing in.",
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#090b10] text-slate-100 lg:grid-cols-2">
      <section className="relative hidden overflow-hidden border-r border-white/10 bg-[#10141c] p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-orange-500 p-2.5 text-white">
            <CarFront size={25} />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight">Garahe Tracker</p>
            <p className="text-xs text-slate-500">YOUR CAR. YOUR RECORDS.</p>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-orange-400">
            Ownership, organized
          </p>
          <h1 className="text-5xl font-semibold leading-tight tracking-tight">
            Know your car.
            <br />
            <span className="text-slate-500">Own every mile.</span>
          </h1>
          <p className="mt-6 max-w-md leading-7 text-slate-400">
            Keep maintenance records, track fuel economy, and understand
            what your vehicle really costs to own.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <Wrench className="mb-3 text-orange-400" />
              <p className="font-medium">Service history</p>
              <p className="mt-1 text-sm text-slate-500">
                Every repair in one place
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <Gauge className="mb-3 text-orange-400" />
              <p className="font-medium">Vehicle insights</p>
              <p className="mt-1 text-sm text-slate-500">
                Mileage, fuel, and costs
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600">
          Garahe Tracker · VEHICLE OWNERSHIP TRACKER
        </p>
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link to="/login" className="mb-12 flex items-center gap-3 lg:hidden">
            <span className="rounded-xl bg-orange-500 p-2 text-white">
              <CarFront size={24} />
            </span>
            <span className="text-xl font-bold">Garahe Tracker</span>
          </Link>

          <p className="text-sm font-medium text-orange-400">
            YOUR GARAGE STARTS HERE
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            {isSignup ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {isSignup
              ? "Start keeping your vehicle records organized."
              : "Sign in to manage your garage and service history."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {isSignup && (
              <div>
                <label htmlFor="name" className="mb-2 block text-sm text-slate-300">
                  Display name
                </label>
                <input
                  id="name"
                  autoComplete="name"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#11151d] px-4 py-3 outline-none transition focus:border-orange-500"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-sm text-slate-300">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#11151d] px-4 py-3 outline-none transition focus:border-orange-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm text-slate-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#11151d] px-4 py-3 outline-none transition focus:border-orange-500"
                placeholder="At least 8 characters"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </p>
            )}

            {message && (
              <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white transition hover:bg-orange-400 disabled:opacity-60"
            >
              {submitting
                ? "Please wait..."
                : isSignup
                  ? "Create account"
                  : "Sign in"}
              {!submitting && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            {isSignup ? "Already have an account?" : "New to Garahe Tracker?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsSignup((value) => !value);
                setError("");
                setMessage("");
              }}
              className="font-medium text-orange-400 hover:text-orange-300"
            >
              {isSignup ? "Sign in" : "Create account"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

// function NavigateToDashboard({ navigate }: { navigate: () => void }) {
//   useEffect(() => {
//     navigate();
//   }, [navigate]);

//   return null;
// }
