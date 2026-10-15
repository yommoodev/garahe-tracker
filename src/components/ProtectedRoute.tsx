
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090b10] text-slate-400">
        Checking your session...
      </div>
    );
  }

  return session ? <Outlet /> : <Navigate to="/login" replace />;
}
