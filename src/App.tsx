import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";

const AuthPage = lazy(() => import("./pages/AuthPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const VehiclesPage = lazy(() => import("./pages/VehiclePage"));
const MaintenancePage = lazy(() => import("./pages/MaintenancePage"));
const FuelPage = lazy(() => import("./pages/FuelPage"));
const MaintenanceRemindersPage = lazy(
  () => import("./pages/MaintenanceRemindersPage"),
);
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));

function PageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090b10] text-slate-400">
      Loading page...
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090b10] text-slate-400">
        Starting Garahe Tracker...
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/fuel" element={<FuelPage />} />
            <Route
              path="/reminders"
              element={<MaintenanceRemindersPage />}
            />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
