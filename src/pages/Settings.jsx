import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { KeyRound, Save, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import FieldError from "../components/ui/FieldError";
import LottieLoader from "../components/ui/LottieLoader";
import CompanyProfileFields from "../components/CompanyProfileFields";
import {
  COMPANY_SECTIONS,
  companyToForm,
  emptyCompanyForm,
  formToPayload,
} from "../utils/companyProfile";
import { companyApi, usersApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  fieldClass,
  hasErrors,
  validateCompanyForm,
  validateNewUserForm,
} from "../utils/formValidation";

const ROLE_LABELS = {
  admin: "Admin - can add, edit and delete",
  viewer: "View only - can see everything, change nothing",
};

function CompanySection() {
  const toast = useToast();
  const { updateCompany } = useAuth();
  const [form, setForm] = useState(emptyCompanyForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    companyApi
      .get()
      .then((res) => {
        if (active) setForm(companyToForm(res.data.company));
      })
      .catch((error) => toast.error(error.message))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // The toast helper is stable; re-running on it would refetch endlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (path, value) => {
    setForm((prev) => {
      const next = { ...prev };
      if (path.startsWith("dlNumbers.")) {
        const index = Number(path.split(".")[1]);
        next.dlNumbers = [...prev.dlNumbers];
        next.dlNumbers[index] = value;
      } else if (path.startsWith("bank.")) {
        next.bank = { ...prev.bank, [path.split(".")[1]]: value };
      } else {
        next[path] = value;
      }
      return next;
    });
    setErrors((prev) => {
      if (!prev[path]) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validateCompanyForm(form);
    setErrors(validation);
    if (hasErrors(validation)) {
      toast.error("Please fix the highlighted details.");
      return;
    }

    setSaving(true);
    try {
      const res = await companyApi.update(formToPayload(form));
      setForm(companyToForm(res.data.company));
      // Keeps the sidebar name and logo in step with what was just saved.
      updateCompany(res.data.company);
      toast.success(res.message || "Company profile saved.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LottieLoader message="Loading company profile..." />;
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="card-header">
        <h3>Company profile</h3>
      </div>

      <div className="card-body settings-sections">
        {COMPANY_SECTIONS.map((section) => (
          <section key={section.id} className="settings-section">
            <h4>{section.title}</h4>
            <p className="settings-section-hint">{section.description}</p>
            <div className="form-grid">
              <CompanyProfileFields
                section={section.id}
                form={form}
                errors={errors}
                setField={setField}
                onLogoError={(message) => toast.error(message)}
                disabled={saving}
              />
            </div>
          </section>
        ))}

        <div className="settings-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} />
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

function UsersSection() {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await usersApi.list();
      setUsers(res.data.items || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeRole = async (target, role) => {
    setBusyId(target.id);
    try {
      await usersApi.update(target.id, { role });
      toast.success("User details saved.");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const removeUser = async (target) => {
    setBusyId(target.id);
    try {
      const res = await usersApi.remove(target.id);
      toast.success(res.message || "User removed successfully.");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>
          <Users size={16} /> Users
        </h3>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setShowCreate(true)}
        >
          <UserPlus size={15} />
          Add user
        </button>
      </div>

      <div className="card-body">
        {loading ? (
          <LottieLoader message="Loading users..." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Access</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {users.map((item) => {
                  const isSelf = item.id === currentUser?.id;
                  return (
                    <tr key={item.id}>
                      <td>
                        {item.name || "-"}
                        {isSelf ? <span className="badge badge-neutral">You</span> : null}
                      </td>
                      <td>{item.username}</td>
                      <td>
                        {/* Changing your own role is refused by the API, so it
                            is not offered here either. */}
                        <select
                          value={item.role}
                          onChange={(e) => changeRole(item, e.target.value)}
                          disabled={isSelf || busyId === item.id}
                          aria-label={`Access level for ${item.username}`}
                        >
                          <option value="admin">Admin</option>
                          <option value="viewer">View only</option>
                        </select>
                      </td>
                      <td className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setResetTarget(item)}
                          disabled={busyId === item.id}
                        >
                          <KeyRound size={15} />
                          Reset password
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => removeUser(item)}
                          disabled={isSelf || busyId === item.id}
                        >
                          <Trash2 size={15} />
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate ? (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await load();
          }}
        />
      ) : null}

      {resetTarget ? (
        <ResetPasswordModal
          target={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      ) : null}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    role: "viewer",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const validation = validateNewUserForm(form);
    setErrors(validation);
    if (hasErrors(validation)) return;

    setSaving(true);
    try {
      const res = await usersApi.create({
        username: form.username.trim().toLowerCase(),
        password: form.password,
        name: form.name.trim(),
        role: form.role,
      });
      toast.success(res.message || "User created successfully.");
      await onCreated();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add user"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Creating..." : "Create user"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="input-group">
          <label htmlFor="new-user-name">Full name</label>
          <input
            id="new-user-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="input-group">
          <label htmlFor="new-user-username">Username *</label>
          <input
            id="new-user-username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className={fieldClass(errors, "username")}
            autoComplete="off"
          />
          <FieldError message={errors.username} />
        </div>

        <div className="input-group">
          <label htmlFor="new-user-password">Password *</label>
          <input
            id="new-user-password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className={fieldClass(errors, "password")}
            autoComplete="new-password"
          />
          <FieldError message={errors.password} />
        </div>

        <div className="input-group">
          <label htmlFor="new-user-role">Access level</label>
          <select
            id="new-user-role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="viewer">View only</option>
            <option value="admin">Admin</option>
          </select>
          <span className="input-hint">{ROLE_LABELS[form.role]}</span>
        </div>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ target, onClose }) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    try {
      const res = await usersApi.update(target.id, { password });
      toast.success(res.message || "Password updated successfully.");
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Reset password for ${target.username}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Saving..." : "Set password"}
          </button>
        </>
      }
    >
      <div className="input-group">
        <label htmlFor="reset-password">New password</label>
        <input
          id="reset-password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          className={error ? "has-error" : ""}
          autoComplete="new-password"
        />
        <FieldError message={error} />
      </div>
    </Modal>
  );
}

export default function Settings() {
  const { isAdmin } = useAuth();

  // Viewers have nothing to do here, and the API would refuse every call.
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="page">
      <PageHeader
        heading="Settings"
        action={
          <span className="badge badge-neutral">
            <ShieldCheck size={14} /> Admin
          </span>
        }
      />

      <CompanySection />
      <UsersSection />
    </div>
  );
}
