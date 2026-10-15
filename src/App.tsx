
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import VehiclesPage from "./pages/VehiclePage";
import MaintenancePage from "./pages/MaintenancePage";
import FuelPage from './pages/FuelPage';
import MaintenanceRemindersPage from './pages/MaintenanceRemindersPage';

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090b10] text-slate-400">
        Starting GarageLog...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="*" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<AuthPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
      </Route>
      <Route element={<ProtectedRoute/>}>
        <Route  path="/vehicles" element={<VehiclesPage />} />
      </Route>

      <Route element={<ProtectedRoute/>}>
        <Route  path="/maintenance" element={<MaintenancePage />} />
      </Route>

      <Route element={<ProtectedRoute/>}>
        <Route  path="/fuel" element={<FuelPage />} />
      </Route>

      <Route element={<ProtectedRoute/>}>
        <Route  path="/reminders" element={<MaintenanceRemindersPage />} />
      </Route>
    </Routes>
  );
}
