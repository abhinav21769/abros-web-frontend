import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import Modal from "../components/ui/Modal";
import FieldError from "../components/ui/FieldError";
import LottieLoader from "../components/ui/LottieLoader";
import { medicinesApi, purchasesApi } from "../api/client";
import { useToast } from "../context/ToastContext";
import {
  formatCalendarDate,
  getTodayDateInputValue,
  toInvoiceDatePayload,
} from "../utils/dateUtils";
import {
  clearFieldError,
  fieldClass,
  hasErrors,
  validatePurchaseForm,
} from "../utils/formValidation";

const emptyItem = {
  medicine: "",
  medicineName: "",
  quantity: "1",
  rate: "",
};

const emptyForm = {
  purchaseNumber: "",
  purchaseDate: getTodayDateInputValue(),
  supplier: "",
  notes: "",
  items: [{ ...emptyItem }],
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value) || 0);
}

export default function Purchases() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 10 };
    if (search) params.purchaseNumber = search;

    purchasesApi
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

  const loadFormData = async () => {
    const [medRes, numRes] = await Promise.all([
      medicinesApi.list({ limit: 500, expired: "false" }),
      purchasesApi.generateNumber(),
    ]);
    setMedicines(medRes.data.items);
    return {
      purchaseNumber: numRes.data.purchaseNumber,
      medicines: medRes.data.items,
    };
  };

  const openCreate = async () => {
    try {
      const { purchaseNumber, medicines: activeMedicines } = await loadFormData();
      if (activeMedicines.length === 0) {
        toast.error("Add medicines to inventory before recording a purchase.");
        return;
      }
      setForm({ ...emptyForm, purchaseNumber, items: [{ ...emptyItem }] });
      setFormErrors({});
      setModalOpen(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => clearFieldError(prev, name));
  };

  const itemFieldError = (index, field) =>
    formErrors[`items.${index}.${field}`];

  const handleItemChange = (index, field, value) => {
    setForm((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], [field]: value };

      if (field === "medicine") {
        const med = medicines.find((m) => m._id === value);
        if (med) {
          nextItems[index].medicineName = med.name;
          nextItems[index].rate = String(med.rate ?? med.ptr ?? "");
        } else {
          nextItems[index].medicineName = "";
          nextItems[index].rate = "";
        }
      }

      return { ...prev, items: nextItems };
    });
    setFormErrors((prev) =>
      clearFieldError(prev, `items.${index}.${field}`),
    );
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

  const totalAmount = useMemo(
    () =>
      form.items.reduce(
        (sum, item) =>
          sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0),
        0,
      ),
    [form.items],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validatePurchaseForm(form);
    setFormErrors(errors);
    if (hasErrors(errors)) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);

    const payload = {
      purchaseNumber: form.purchaseNumber,
      purchaseDate: toInvoiceDatePayload(form.purchaseDate),
      supplier: form.supplier || undefined,
      notes: form.notes || undefined,
      items: form.items.map((item) => ({
        medicine: item.medicine,
        medicineName: item.medicineName,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
      })),
    };

    try {
      const res = await purchasesApi.create(payload);
      toast.success(res.message);
      setModalOpen(false);
      fetchItems();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Purchases"
        subtitle="Record stock purchases and update inventory"
        action={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> New Purchase
          </button>
        }
      />

      <div className="card">
        <div className="toolbar">
          <input
            type="text"
            placeholder="Search by purchase number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {loading ? (
          <div className="loading">
            <LottieLoader message="Loading purchases..." compact />
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">No purchase entries found</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Purchase #</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Items</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <strong>{item.purchaseNumber}</strong>
                      </td>
                      <td>{formatCalendarDate(item.purchaseDate)}</td>
                      <td>{item.supplier || "—"}</td>
                      <td>{item.items?.length || 0}</td>
                      <td>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              pagination={pagination}
              page={page}
              onPageChange={setPage}
              itemLabel="purchases"
            />
          </>
        )}
      </div>

      {modalOpen && (
        <Modal
          title="New Purchase Entry"
          onClose={() => setModalOpen(false)}
          large
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
                {saving ? "Saving..." : "Save Purchase"}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="invoice-form">
            {formErrors.items && typeof formErrors.items === "string" && (
              <div className="form-error-banner">{formErrors.items}</div>
            )}

            <div className="invoice-form-grid">
              <div className="input-group">
                <label>Purchase Number *</label>
                <input
                  name="purchaseNumber"
                  value={form.purchaseNumber}
                  onChange={handleChange}
                  className={fieldClass(formErrors, "purchaseNumber")}
                />
                <FieldError message={formErrors.purchaseNumber} />
              </div>
              <div className="input-group">
                <label>Purchase Date *</label>
                <input
                  type="date"
                  name="purchaseDate"
                  value={form.purchaseDate}
                  onChange={handleChange}
                  className={fieldClass(formErrors, "purchaseDate")}
                />
                <FieldError message={formErrors.purchaseDate} />
              </div>
              <div className="input-group">
                <label>Supplier</label>
                <input
                  name="supplier"
                  value={form.supplier}
                  onChange={handleChange}
                  placeholder="Distributor / supplier name"
                />
              </div>
            </div>

            <div className="input-group">
              <label>Notes</label>
              <input
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Optional notes"
              />
            </div>

            <div className="invoice-items-header">
              <strong>Line Items</strong>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={addItem}
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div className="invoice-items">
              {form.items.map((item, index) => (
                <div key={index} className="invoice-item-card">
                  <div className="invoice-item-row invoice-item-row-top">
                    <div className="input-group">
                      <label>Medicine *</label>
                      <select
                        value={item.medicine}
                        onChange={(e) =>
                          handleItemChange(index, "medicine", e.target.value)
                        }
                        className={fieldClass(
                          formErrors,
                          `items.${index}.medicine`,
                        )}
                      >
                        <option value="">Select medicine</option>
                        {medicines.map((m) => (
                          <option key={m._id} value={m._id}>
                            {m.name} — Stock {m.quantity ?? 0}
                          </option>
                        ))}
                      </select>
                      <FieldError message={itemFieldError(index, "medicine")} />
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
                        className={fieldClass(
                          formErrors,
                          `items.${index}.quantity`,
                        )}
                      />
                      <FieldError message={itemFieldError(index, "quantity")} />
                    </div>
                    <div className="input-group">
                      <label>Rate (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) =>
                          handleItemChange(index, "rate", e.target.value)
                        }
                        className={fieldClass(formErrors, `items.${index}.rate`)}
                      />
                      <FieldError message={itemFieldError(index, "rate")} />
                    </div>
                    {form.items.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost invoice-item-remove"
                        onClick={() => removeItem(index)}
                        aria-label="Remove item"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="invoice-total">
              <div className="invoice-total-row invoice-total-grand">
                <span>Total</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
