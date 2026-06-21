import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import { medicinesApi } from "../api/client";
import { useToast } from "../context/ToastContext";

const PTR_DISCOUNT = 0.238;

const emptyForm = {
  name: "",
  expiryDate: "",
  packagingType: "",
  mrp: "",
  rate: "",
  quantity: "",
  batchNumber: "",
  manufacturer: "",
  hsn: "",
  description: "",
};

function calcPtr(mrp) {
  const value = Number(mrp);
  if (!value || value < 0) return 0;
  return Math.round(value * (1 - PTR_DISCOUNT) * 100) / 100;
}

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
  if (days <= 30)
    return <span className="badge badge-warning">{days}d left</span>;
  return <span className="badge badge-success">Active</span>;
}

export default function Inventory() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 10 };
    if (search) params.name = search;

    medicinesApi
      .list(params)
      .then((res) => {
        setItems(res.data.items);
        setPagination(res.data.pagination);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [page, search, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name,
      expiryDate: item.expiryDate.split("T")[0],
      packagingType: item.packagingType,
      mrp: String(item.mrp),
      rate: String(item.rate ?? ""),
      quantity: String(item.quantity),
      batchNumber: item.batchNumber || "",
      manufacturer: item.manufacturer || "",
      hsn: item.hsn || "",
      description: item.description || "",
    });
    setModalOpen(true);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      name: form.name,
      expiryDate: new Date(form.expiryDate).toISOString(),
      packagingType: form.packagingType,
      mrp: Number(form.mrp),
      rate: Number(form.rate),
      ptr: calcPtr(form.mrp),
      quantity: Number(form.quantity) || 0,
      batchNumber: form.batchNumber || undefined,
      manufacturer: form.manufacturer || undefined,
      hsn: form.hsn || undefined,
      description: form.description || undefined,
    };

    try {
      const res = editing
        ? await medicinesApi.update(editing._id, payload)
        : await medicinesApi.create(payload);
      toast.success(res.message);
      setModalOpen(false);
      fetchItems();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this medicine from inventory?")) return;
    try {
      const res = await medicinesApi.remove(id);
      toast.success(res.message);
      fetchItems();
    } catch (err) {
      toast.error(err.message);
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
                    <th>HSN</th>
                    <th>Batch</th>
                    <th>Expiry</th>
                    <th>Qty</th>
                    <th>MRP</th>
                    <th>Rate</th>
                    <th>PTR</th>
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
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {item.manufacturer}
                          </div>
                        )}
                      </td>
                      <td>{item.packagingType}</td>
                      <td>{item.hsn || "—"}</td>
                      <td>{item.batchNumber || "—"}</td>
                      <td>{formatDate(item.expiryDate)}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.mrp)}</td>
                      <td>{formatCurrency(item.rate)}</td>
                      <td>{formatCurrency(item.ptr)}</td>
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
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="input-group full-width">
              <label>Medicine Name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
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
              <input
                name="batchNumber"
                value={form.batchNumber}
                onChange={handleChange}
              />
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
              <label>Rate (₹) *</label>
              <input
                type="number"
                name="rate"
                value={form.rate}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
              />
            </div>
            <div className="input-group">
              <label>PTR (₹)</label>
              <input
                type="text"
                value={form.mrp ? formatCurrency(calcPtr(form.mrp)) : "—"}
                readOnly
                style={{
                  background: "var(--bg-muted, #f4f4f5)",
                  cursor: "not-allowed",
                }}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Auto-calculated: MRP − 23.8%
              </span>
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
              <input
                name="manufacturer"
                value={form.manufacturer}
                onChange={handleChange}
              />
            </div>
            <div className="input-group">
              <label>HSN</label>
              <input
                name="hsn"
                value={form.hsn}
                onChange={handleChange}
                placeholder="e.g. 3004"
              />
            </div>
            <div className="input-group full-width">
              <label>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
              />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
