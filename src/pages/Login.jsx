import { useState } from "react";
import { Navigate } from "react-router-dom";
import { User, Lock, ArrowRight } from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import FieldError from "../components/ui/FieldError";
import LottieLoader from "../components/ui/LottieLoader";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  clearFieldError,
  fieldClass,
  hasErrors,
  validateLoginForm,
} from "../utils/formValidation";

export default function Login() {
  const toast = useToast();
  const { login, isAuthenticated, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <LottieLoader fullScreen message="Authenticating session..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateLoginForm({ username, password });
    setFormErrors(errors);
    if (hasErrors(errors)) return;

    setSubmitting(true);

    try {
      const res = await login(username.trim(), password);
      toast.success(res.message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <BrandLogo size={48} />
          <div>
            <h1>Abros Healthcare</h1>
            <p>Pharmaceutical Management ERP</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label htmlFor="username" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <User size={14} color="var(--primary)" /> Username
            </label>
            <input
              id="username"
              name="username"
              value={username}
              placeholder="Enter your username"
              onChange={(e) => {
                setUsername(e.target.value);
                setFormErrors((prev) => clearFieldError(prev, "username"));
              }}
              autoComplete="username"
              className={fieldClass(formErrors, "username")}
            />
            <FieldError message={formErrors.username} />
          </div>

          <div className="input-group">
            <label htmlFor="password" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Lock size={14} color="var(--primary)" /> Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFormErrors((prev) => clearFieldError(prev, "password"));
              }}
              autoComplete="current-password"
              className={fieldClass(formErrors, "password")}
            />
            <FieldError message={formErrors.password} />
          </div>

          <button className="btn btn-primary login-submit" disabled={submitting}>
            {submitting ? "Signing in..." : (
              <>
                Sign In to Dashboard <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
