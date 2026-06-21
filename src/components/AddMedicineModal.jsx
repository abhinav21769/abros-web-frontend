import { useState } from "react";
import Modal from "./ui/Modal";
import FieldError from "./ui/FieldError";
import { medicinesApi } from "../api/client";
import { useToast } from "../context/ToastContext";
import { GST_RATE_OPTIONS } from "../utils/invoiceTax";
import {
  clearFieldError,
  fieldClass,
  hasErrors,
  validateMedicineForm,
} from "../utils/formValidation";

const PTR_DISCOUNT = 0.238;

const emptyForm = {
  name: "",
  expiryDate: "",
  packagingType: "",
  mrp: "",
  rate: "",
  gstRate: "5",
  batchNumber: "",
  manufacturer: "",
  hsn: "",
};

function calcPtr(mrp) {
  const value = Number(mrp);
  if (!value || value < 0) return 0;
  return Math.round(value * (1 - PTR_DISCOUNT) * 100) / 100;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value) || 0);
}

export default function AddMedicineModal({ onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => clearFieldError(prev, name));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateMedicineForm({ ...form, quantity: "0" });
    setFormErrors(errors);
    if (hasErrors(errors)) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      expiryDate: new Date(form.expiryDate).toISOString(),
      packagingType: form.packagingType.trim(),
      mrp: Number(form.mrp),
      rate: Number(form.rate),
      ptr: calcPtr(form.mrp),
      quantity: 0,
      batchNumber: form.batchNumber.trim() || undefined,
      manufacturer: form.manufacturer.trim() || undefined,
      hsn: form.hsn.trim() || undefined,
      gstRate: Number(form.gstRate) || 5,
    };

    try {
      const res = await medicinesApi.create(payload);
      toast.success(res.message);
      onCreated(res.data);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add New Medicine"
      onClose={onClose}
      large
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Saving..." : "Add Medicine"}
          </button>
        </>
      }
    >
      <p className="form-hint" style={{ marginBottom: 16 }}>
        Stock starts at 0 and will be added when this purchase order is marked
        paid.
      </p>
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="input-group full-width">
          <label>Medicine Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            className={fieldClass(formErrors, "name")}
          />
          <FieldError message={formErrors.name} />
        </div>
        <div className="input-group">
          <label>Packaging Type *</label>
          <input
            name="packagingType"
            value={form.packagingType}
            onChange={handleChange}
            placeholder="Strip, Bottle, Box..."
            className={fieldClass(formErrors, "packagingType")}
          />
          <FieldError message={formErrors.packagingType} />
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
            className={fieldClass(formErrors, "expiryDate")}
          />
          <FieldError message={formErrors.expiryDate} />
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
            className={fieldClass(formErrors, "mrp")}
          />
          <FieldError message={formErrors.mrp} />
        </div>
        <div className="input-group">
          <label>Purchase Rate (₹) *</label>
          <input
            type="number"
            name="rate"
            value={form.rate}
            onChange={handleChange}
            min="0"
            step="0.01"
            className={fieldClass(formErrors, "rate")}
          />
          <FieldError message={formErrors.rate} />
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
          <label>GST Rate (%) *</label>
          <select name="gstRate" value={form.gstRate} onChange={handleChange}>
            {GST_RATE_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                {rate}%
              </option>
            ))}
          </select>
        </div>
        <div className="input-group">
          <label>HSN</label>
          <input
            name="hsn"
            value={form.hsn}
            onChange={handleChange}
            placeholder="e.g. 3004"
            className={fieldClass(formErrors, "hsn")}
          />
          <FieldError message={formErrors.hsn} />
        </div>
      </form>
    </Modal>
  );
}
