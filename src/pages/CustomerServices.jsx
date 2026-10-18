import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, LockOpen, Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import Modal from "../components/ui/Modal";
import FieldError from "../components/ui/FieldError";
import LottieLoader from "../components/ui/LottieLoader";
import { customersApi, customerServicesApi, SECTION_LOCKED } from "../api/client";
import { useToast } from "../context/ToastContext";
import {
  formatCalendarDate,
  getTodayDateInputValue,
  toDateInputValue,
  toInvoiceDatePayload,
} from "../utils/dateUtils";
import {
  clearFieldError,
  fieldClass,
  hasErrors,
  validateCustomerServiceForm,
} from "../utils/formValidation";

const emptyForm = () => ({
  customerName: "",
  amount: "",
  date: getTodayDateInputValue(),
  remarks: "",
});

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value) || 0);
}

export function SectionLock({ onUnlock }) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError("Password is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await customerServicesApi.unlock(password);
      onUnlock(res.data.token);
    } catch (err) {
      setError(err.message);
      setPassword("");
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="section-lock">
      <form className="card section-lock-card" onSubmit={handleSubmit}>
        <div className="section-lock-icon">
          <Lock size={22} />
        </div>
        <h2>Customer Services</h2>
        <p>This section is password protected. Enter the password to continue.</p>
        <div className="input-group">
          <label htmlFor="section-password">Password</label>
          <input
            id="section-password"
            type="password"
            value={password}
            autoFocus
            autoComplete="off"
            placeholder="Enter section password"
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            className={error ? "has-error" : ""}
          />
          <FieldError message={error} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <LockOpen size={16} /> {submitting ? "Unlocking..." : "Unlock"}
        </button>
      </form>
    </div>
  );
}

// The section token lives only in this component's state: navigating away
// unmounts the page and drops it, so every visit asks for the password again.
export default function CustomerServices() {
  const [sectionToken, setSectionToken] = useState(null);
  const lock = useCallback(() => setSectionToken(null), []);

  if (!sectionToken) {
    return <SectionLock onUnlock={setSectionToken} />;
  }

  return <CustomerServicesLedger sectionToken={sectionToken} onLock={lock} />;
}

function CustomerServicesLedger({ sectionToken, onLock }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [recordedNames, setRecordedNames] = useState([]);
  const [customerNames, setCustomerNames] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // An expired section token comes back as SECTION_LOCKED: drop back to the
  // lock screen rather than showing a broken page.
  const handleError = useCallback(
    (err) => {
      if (err.code === SECTION_LOCKED) {
        toast.error(err.message);
        onLock();
        return;
      }
      toast.error(err.message);
    },
    [toast, onLock],
  );

  const fetchItems = useCallback(() => {
    setLoading(true);
    const params = { page, limit };
    if (search.trim()) params.search = search.trim();
    if (customerFilter) params.customerName = customerFilter;

    customerServicesApi
      .list(sectionToken, params)
      .then((res) => {
        setItems(res.data.items);
        setPagination(res.data.pagination);
        setTotalAmount(res.data.totalAmount || 0);
      })
      .catch(handleError)
      .finally(() => setLoading(false));
  }, [sectionToken, page, limit, search, customerFilter, handleError]);

  const fetchRecordedNames = useCallback(() => {
    customerServicesApi
      .customerNames(sectionToken)
      .then((res) => setRecordedNames(res.data || []))
      .catch(handleError);
  }, [sectionToken, handleError]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchRecordedNames();
  }, [fetchRecordedNames]);

  // Existing customers only feed the name suggestions; a name typed by hand is
  // just as valid, since gifts also go to people who are not billed customers.
  useEffect(() => {
    customersApi
      .listAll()
      .then((list) => setCustomerNames(list.map((c) => c.name)))
      .catch(() => setCustomerNames([]));
  }, []);

  const nameSuggestions = useMemo(
    () =>
      [...new Set([...recordedNames, ...customerNames])].sort((a, b) =>
        a.localeCompare(b, "en", { sensitivity: "base" }),
      ),
    [recordedNames, customerNames],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      customerName: item.customerName,
      amount: String(item.amount ?? ""),
      date: toDateInputValue(item.date),
      remarks: item.remarks || "",
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => clearFieldError(prev, name));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateCustomerServiceForm(form);
    setFormErrors(errors);
    if (hasErrors(errors)) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    const payload = {
      customerName: form.customerName.trim(),
      amount: Number(form.amount),
      date: toInvoiceDatePayload(form.date),
      remarks: form.remarks.trim(),
    };

    try {
      const res = editing
        ? await customerServicesApi.update(sectionToken, editing._id, payload)
        : await customerServicesApi.create(sectionToken, payload);
      toast.success(res.message);
      setModalOpen(false);
      fetchItems();
      fetchRecordedNames();
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete this entry for ${item.customerName}?`)) return;
    try {
      const res = await customerServicesApi.remove(sectionToken, item._id);
      toast.success(res.message);
      fetchItems();
      fetchRecordedNames();
    } catch (err) {
      handleError(err);
    }
  };

  return (
    <>
      <PageHeader
        title="Customer Services"
        action={
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button className="btn btn-secondary" onClick={onLock}>
              <Lock size={16} /> Lock
            </button>
            <button className="btn btn-primary" onClick={openCreate}>
              <Plus size={16} /> Add Entry
            </button>
          </div>
        }
      />

      <div className="card">
        <div className="toolbar">
          <div className="customer-services-filters">
            <input
              type="text"
              placeholder="Search by customer or remarks..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              aria-label="Filter by customer"
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All customers</option>
              {recordedNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="customer-services-total">
            <ShieldCheck size={16} />
            <span>Total</span>
            <strong>{formatCurrency(totalAmount)}</strong>
          </div>
        </div>

        {loading ? (
          <div className="loading">
            <LottieLoader message="Loading entries..." compact />
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">No entries found</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Remarks</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id}>
                      <td><strong>{item.customerName}</strong></td>
                      <td>{formatCurrency(item.amount)}</td>
                      <td>{formatCalendarDate(item.date)}</td>
                      <td className="customer-services-remarks">{item.remarks || "—"}</td>
                      <td>
                        <div className="actions-cell">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEdit(item)}
                            aria-label="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDelete(item)}
                            aria-label="Delete"
                          >
                            <Trash2 size={15} color="var(--danger)" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              pagination={pagination}
              page={page}
              onPageChange={setPage}
              limit={limit}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
              itemLabel="entries"
            />
          </>
        )}
      </div>

      {modalOpen && (
        <Modal
          title={editing ? "Edit Entry" : "Add Entry"}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving..." : editing ? "Update" : "Create"}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="input-group full-width">
              <label htmlFor="cs-customer-name">Customer Name *</label>
              <input
                id="cs-customer-name"
                name="customerName"
                list="cs-customer-name-options"
                value={form.customerName}
                onChange={handleChange}
                autoComplete="off"
                placeholder="Pick a customer or type a name"
                className={fieldClass(formErrors, "customerName")}
              />
              <datalist id="cs-customer-name-options">
                {nameSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <FieldError message={formErrors.customerName} />
            </div>
            <div className="input-group">
              <label htmlFor="cs-amount">Amount (₹) *</label>
              <input
                id="cs-amount"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.amount}
                onChange={handleChange}
                className={fieldClass(formErrors, "amount")}
              />
              <FieldError message={formErrors.amount} />
            </div>
            <div className="input-group">
              <label htmlFor="cs-date">Date *</label>
              <input
                id="cs-date"
                name="date"
                type="date"
                value={form.date}
                onChange={handleChange}
                className={fieldClass(formErrors, "date")}
              />
              <FieldError message={formErrors.date} />
            </div>
            <div className="input-group full-width">
              <label htmlFor="cs-remarks">Remarks</label>
              <textarea
                id="cs-remarks"
                name="remarks"
                value={form.remarks}
                onChange={handleChange}
                maxLength={1000}
                placeholder="What was given, occasion, etc."
                className={fieldClass(formErrors, "remarks")}
              />
              <FieldError message={formErrors.remarks} />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
