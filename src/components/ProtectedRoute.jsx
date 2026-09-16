import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LottieLoader from "./ui/LottieLoader";

export default function ProtectedRoute() {
  const { isAuthenticated, loading, needsOnboarding, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LottieLoader fullScreen message="Loading..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // A company whose setup is unfinished has no letterhead, so its admin is held
  // on the wizard until it is done. A viewer cannot fill it in, so they are told
  // to ask their admin instead of being bounced around.
  if (needsOnboarding && isAdmin && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
