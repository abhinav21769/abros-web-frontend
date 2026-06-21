import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import Modal from "../components/ui/Modal";
import FieldError from "../components/ui/FieldError";
import LottieLoader from "../components/ui/LottieLoader";
import { customersApi } from "../api/client";
import { useToast } from "../context/ToastContext";
import {
  clearFieldError,
  fieldClass,
  hasErrors,
  validateCustomerForm,
} from "../utils/formValidation";

const emptyForm = {
  name: "",
  address: "",
  contact: "",
  gstin: "",
  dlNo: "",
};

export default function Customers() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 10 };
    if (search) params.name = search;

    customersApi
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
    setFormErrors({});
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
    const errors = validateCustomerForm(form);
    setFormErrors(errors);
    if (hasErrors(errors)) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name,
      address: form.address,
      contact: form.contact || undefined,
      gstin: form.gstin || undefined,
      dlNo: form.dlNo || undefined,
    };

    try {
      const res = editing
        ? await customersApi.update(editing._id, payload)
        : await customersApi.create(payload);
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
    if (!confirm("Delete this customer?")) return;
    try {
      const res = await customersApi.remove(id);
      toast.success(res.message);
      fetchItems();
    } catch (err) {
      toast.error(err.message);
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
          <div className="loading">
            <LottieLoader message="Loading customers..." compact />
          </div>
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

            <Pagination
              pagination={pagination}
              page={page}
              onPageChange={setPage}
              itemLabel="customers"
            />
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
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="input-group full-width">
              <label>Store / Customer Name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className={fieldClass(formErrors, "name")}
              />
              <FieldError message={formErrors.name} />
            </div>
            <div className="input-group full-width">
              <label>Address *</label>
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                className={fieldClass(formErrors, "address")}
              />
              <FieldError message={formErrors.address} />
            </div>
            <div className="input-group">
              <label>Contact</label>
              <input
                name="contact"
                value={form.contact}
                onChange={handleChange}
                placeholder="10-digit mobile"
                className={fieldClass(formErrors, "contact")}
              />
              <FieldError message={formErrors.contact} />
            </div>
            <div className="input-group">
              <label>GSTIN</label>
              <input
                name="gstin"
                value={form.gstin}
                onChange={handleChange}
                placeholder="15-character GSTIN"
                className={fieldClass(formErrors, "gstin")}
              />
              <FieldError message={formErrors.gstin} />
            </div>
            <div className="input-group full-width">
              <label>Drug License No.</label>
              <input
                name="dlNo"
                value={form.dlNo}
                onChange={handleChange}
                className={fieldClass(formErrors, "dlNo")}
              />
              <FieldError message={formErrors.dlNo} />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
