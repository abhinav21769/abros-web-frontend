import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, clearAuthToken, getAuthToken, setAuthToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // The company brands the whole shell (name, logo) and decides whether the
  // onboarding wizard still has to run, so it is loaded alongside the user.
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setCompany(null);
      setLoading(false);
      return;
    }

    try {
      const res = await authApi.me();
      setUser(res.data.user);
      setCompany(res.data.company || null);
    } catch {
      clearAuthToken();
      setUser(null);
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (username, password) => {
    const res = await authApi.login({ username, password });
    setAuthToken(res.data.token);
    setUser(res.data.user);
    setCompany(res.data.company || null);
    return res;
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
    setCompany(null);
  };

  // Called after the company profile is saved so the sidebar, logo and the
  // onboarding gate pick up the change without a reload.
  const updateCompany = useCallback((next) => {
    setCompany((current) => ({ ...(current || {}), ...next }));
  }, []);

  const value = useMemo(
    () => ({
      user,
      company,
      loading,
      isAuthenticated: Boolean(user),
      // The single answer to "may this person change anything?". Pages use it to
      // hide controls; the API refuses the call either way.
      isAdmin: user?.role === "admin",
      isViewer: user?.role === "viewer",
      needsOnboarding: Boolean(user) && company?.onboardingCompleted === false,
      login,
      logout,
      updateCompany,
      reloadUser: loadUser,
    }),
    [user, company, loading, updateCompany, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
