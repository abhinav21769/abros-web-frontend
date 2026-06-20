import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import { medicinesApi } from "../api/client";

const emptyForm = {
  name: "",
  expiryDate: "",
  packagingType: "",
  mrp: "",
  quantity: "",
  batchNumber: "",
  manufacturer: "",
  description: "",
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value) || 0);
}

function getExpiryBadge(expiryDate) {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const days = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

  if (days < 0) return <span className="badge badge-danger">Expired</span>;
  if (days <= 30) return <span className="badge badge-warning">{days}d left</span>;
  return <span className="badge badge-success">Active</span>;
}

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
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
    if (search) params.name = search;

    medicinesApi
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

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name,
      expiryDate: item.expiryDate.split("T")[0],
      packagingType: item.packagingType,
      mrp: String(item.mrp),
      quantity: String(item.quantity),
      batchNumber: item.batchNumber || "",
      manufacturer: item.manufacturer || "",
      description: item.description || "",
    });
    setFormError("");
    setModalOpen(true);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = {
      name: form.name,
      expiryDate: new Date(form.expiryDate).toISOString(),
      packagingType: form.packagingType,
      mrp: Number(form.mrp),
      quantity: Number(form.quantity) || 0,
      batchNumber: form.batchNumber || undefined,
      manufacturer: form.manufacturer || undefined,
      description: form.description || undefined,
    };

    try {
      if (editing) {
        await medicinesApi.update(editing._id, payload);
      } else {
        await medicinesApi.create(payload);
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
    if (!confirm("Delete this medicine from inventory?")) return;
    try {
      await medicinesApi.remove(id);
      fetchItems();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Manage medicine stock, expiry dates, and pricing"
        action={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add Medicine
          </button>
        }
      />

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="toolbar">
          <input
            type="text"
            placeholder="Search by medicine name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {loading ? (
          <div className="loading">Loading inventory...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">No medicines found</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Packaging</th>
                    <th>Batch</th>
                    <th>Expiry</th>
                    <th>Qty</th>
                    <th>MRP</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <strong>{item.name}</strong>
                        {item.manufacturer && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {item.manufacturer}
                          </div>
                        )}
                      </td>
                      <td>{item.packagingType}</td>
                      <td>{item.batchNumber || "—"}</td>
                      <td>{formatDate(item.expiryDate)}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.mrp)}</td>
                      <td>{getExpiryBadge(item.expiryDate)}</td>
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
                  {pagination.totalItems} items
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
          title={editing ? "Edit Medicine" : "Add Medicine"}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? "Saving..." : editing ? "Update" : "Create"}
              </button>
            </>
          }
        >
          {formError && <div className="alert alert-error">{formError}</div>}
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="input-group full-width">
              <label>Medicine Name *</label>
              <input name="name" value={form.name} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Packaging Type *</label>
              <input
                name="packagingType"
                value={form.packagingType}
                onChange={handleChange}
                placeholder="Strip, Bottle, Box..."
                required
              />
            </div>
            <div className="input-group">
              <label>Batch Number</label>
              <input name="batchNumber" value={form.batchNumber} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label>Expiry Date *</label>
              <input
                type="date"
                name="expiryDate"
                value={form.expiryDate}
                onChange={handleChange}
                required
              />
            </div>
            <div className="input-group">
              <label>MRP (₹) *</label>
              <input
                type="number"
                name="mrp"
                value={form.mrp}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
              />
            </div>
            <div className="input-group">
              <label>Quantity</label>
              <input
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                min="0"
              />
            </div>
            <div className="input-group">
              <label>Manufacturer</label>
              <input name="manufacturer" value={form.manufacturer} onChange={handleChange} />
            </div>
            <div className="input-group full-width">
              <label>Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
