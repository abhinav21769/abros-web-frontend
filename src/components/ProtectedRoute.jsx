import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LottieLoader from "./ui/LottieLoader";

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LottieLoader fullScreen message="Loading..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
