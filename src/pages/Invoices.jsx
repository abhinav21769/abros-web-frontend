import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import { invoicesApi, customersApi, medicinesApi } from "../api/client";

const emptyItem = { medicine: "", medicineName: "", quantity: "1", rate: "" };

const emptyForm = {
  invoiceNumber: "",
  customer: "",
  status: "pending",
  invoiceDate: new Date().toISOString().split("T")[0],
  notes: "",
  items: [{ ...emptyItem }],
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value) || 0);
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusBadge(status) {
  const map = {
    paid: "badge-success",
    pending: "badge-warning",
    cancelled: "badge-danger",
  };
  return <span className={`badge ${map[status] || "badge-neutral"}`}>{status}</span>;
}

export default function Invoices() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchItems = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 10 };
    if (search) params.invoiceNumber = search;

    invoicesApi
      .list(params)
      .then((res) => {
        setItems(res.data);
        setPagination(res.pagination);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const loadFormData = async () => {
    const [custRes, medRes, numRes] = await Promise.all([
      customersApi.list({ limit: 100 }),
      medicinesApi.list({ limit: 100, expired: "false" }),
      invoicesApi.generateNumber(),
    ]);
    setCustomers(custRes.data);
    setMedicines(medRes.data);
    return numRes.data.invoiceNumber;
  };

  const openCreate = async () => {
    try {
      const invoiceNumber = await loadFormData();
      setEditing(null);
      setForm({ ...emptyForm, invoiceNumber, items: [{ ...emptyItem }] });
      setFormError("");
      setModalOpen(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const openEdit = async (item) => {
    try {
      await loadFormData();
      setEditing(item);
      setForm({
        invoiceNumber: item.invoiceNumber,
        customer: item.customer._id || item.customer,
        status: item.status,
        invoiceDate: item.invoiceDate.split("T")[0],
        notes: item.notes || "",
        items: item.items.map((i) => ({
          medicine: i.medicine?._id || i.medicine || "",
          medicineName: i.medicineName,
          quantity: String(i.quantity),
          rate: String(i.rate),
        })),
      });
      setFormError("");
      setModalOpen(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleItemChange = (index, field, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };

      if (field === "medicine" && value) {
        const med = medicines.find((m) => m._id === value);
        if (med) {
          items[index].medicineName = med.name;
          items[index].rate = String(med.mrp);
        }
      }

      return { ...prev, items };
    });
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...emptyItem }],
    }));
  };

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const calcTotal = () =>
    form.items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0),
      0
    );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = {
      invoiceNumber: form.invoiceNumber,
      customer: form.customer,
      status: form.status,
      invoiceDate: new Date(form.invoiceDate).toISOString(),
      notes: form.notes || undefined,
      items: form.items.map((item) => ({
        medicine: item.medicine || undefined,
        medicineName: item.medicineName,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
      })),
    };

    try {
      if (editing) {
        await invoicesApi.update(editing._id, payload);
      } else {
        await invoicesApi.create(payload);
      }
      setModalOpen(false);
      fetchItems();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this invoice?")) return;
    try {
      await invoicesApi.remove(id);
      fetchItems();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Create and manage sales invoices for customers"
        action={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> New Invoice
          </button>
        }
      />

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="toolbar">
          <input
            type="text"
            placeholder="Search by invoice number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {loading ? (
          <div className="loading">Loading invoices...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">No invoices found</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id}>
                      <td><strong>{item.invoiceNumber}</strong></td>
                      <td>{item.customer?.name || "—"}</td>
                      <td>{formatDate(item.invoiceDate)}</td>
                      <td>{item.items.length}</td>
                      <td>{formatCurrency(item.total)}</td>
                      <td>{statusBadge(item.status)}</td>
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
                            onClick={() => handleDelete(item._id)}
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

            {pagination && pagination.totalPages > 1 && (
              <div className="pagination">
                <span>
                  Page {pagination.currentPage} of {pagination.totalPages} ·{" "}
                  {pagination.totalItems} invoices
                </span>
                <div className="pagination-btns">
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <Modal
          title={editing ? "Edit Invoice" : "New Invoice"}
          onClose={() => setModalOpen(false)}
          large
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving..." : editing ? "Update Invoice" : "Create Invoice"}
              </button>
            </>
          }
        >
          {formError && <div className="alert alert-error">{formError}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid" style={{ marginBottom: 20 }}>
              <div className="input-group">
                <label>Invoice Number *</label>
                <input
                  name="invoiceNumber"
                  value={form.invoiceNumber}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="input-group">
                <label>Date *</label>
                <input
                  type="date"
                  name="invoiceDate"
                  value={form.invoiceDate}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="input-group">
                <label>Customer *</label>
                <select
                  name="customer"
                  value={form.customer}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Status</label>
                <select name="status" value={form.status} onChange={handleChange}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="input-group full-width">
                <label>Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} />
              </div>
            </div>

            <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Line Items</strong>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div className="invoice-items">
              {form.items.map((item, index) => (
                <div key={index} className="invoice-item-row">
                  <div className="input-group">
                    <label>Medicine</label>
                    <select
                      value={item.medicine}
                      onChange={(e) => handleItemChange(index, "medicine", e.target.value)}
                    >
                      <option value="">Custom / Manual</option>
                      {medicines.map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.name} (₹{m.mrp})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Name *</label>
                    <input
                      value={item.medicineName}
                      onChange={(e) =>
                        handleItemChange(index, "medicineName", e.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Qty *</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(index, "quantity", e.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Rate (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                      required
                    />
                  </div>
                  {form.items.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => removeItem(index)}
                      aria-label="Remove item"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="invoice-total">
              Total: {formatCurrency(calcTotal())}
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
