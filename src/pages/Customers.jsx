import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import { customersApi } from "../api/client";

const emptyForm = {
  name: "",
  address: "",
  contact: "",
  gstin: "",
  dlNo: "",
};

export default function Customers() {
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

    customersApi
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
      address: item.address,
      contact: item.contact || "",
      gstin: item.gstin || "",
      dlNo: item.dlNo || "",
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
      address: form.address,
      contact: form.contact || undefined,
      gstin: form.gstin || undefined,
      dlNo: form.dlNo || undefined,
    };

    try {
      if (editing) {
        await customersApi.update(editing._id, payload);
      } else {
        await customersApi.create(payload);
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
    if (!confirm("Delete this customer?")) return;
    try {
      await customersApi.remove(id);
      fetchItems();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Manage medical stores and buyer accounts"
        action={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add Customer
          </button>
        }
      />

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="toolbar">
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {loading ? (
          <div className="loading">Loading customers...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">No customers found</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Contact</th>
                    <th>GSTIN</th>
                    <th>DL No.</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id}>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.address}</td>
                      <td>{item.contact || "—"}</td>
                      <td>{item.gstin || "—"}</td>
                      <td>{item.dlNo || "—"}</td>
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
                  {pagination.totalItems} customers
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
          title={editing ? "Edit Customer" : "Add Customer"}
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
          {formError && <div className="alert alert-error">{formError}</div>}
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="input-group full-width">
              <label>Store / Customer Name *</label>
              <input name="name" value={form.name} onChange={handleChange} required />
            </div>
            <div className="input-group full-width">
              <label>Address *</label>
              <textarea name="address" value={form.address} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Contact</label>
              <input name="contact" value={form.contact} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label>GSTIN</label>
              <input name="gstin" value={form.gstin} onChange={handleChange} />
            </div>
            <div className="input-group full-width">
              <label>Drug License No.</label>
              <input name="dlNo" value={form.dlNo} onChange={handleChange} />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
