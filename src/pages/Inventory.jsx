import { useCallback, useEffect, useState, Fragment } from "react";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import Modal from "../components/ui/Modal";
import FieldError from "../components/ui/FieldError";
import LottieLoader from "../components/ui/LottieLoader";
import { medicinesApi } from "../api/client";
import { useToast } from "../context/ToastContext";
import { GST_RATE_OPTIONS } from "../utils/invoiceTax";
import { toDateInputValue } from "../utils/dateUtils";
import {
  clearFieldError,
  fieldClass,
  hasErrors,
  validateBatchForm,
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
  if (!dateStr) return "—";
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

// null when every batch agrees (nothing to range over) - the caller then
// falls back to displaying the medicine's single mirrored value.
function batchRange(batches, field) {
  if (!batches || batches.length < 2) return null;
  const values = batches.map((b) => Number(b[field]) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? null : { min, max };
}

function formatRange(range) {
  return `${formatCurrency(range.min)} – ${formatCurrency(range.max)}`;
}

function getExpiryBadge(expiryDate) {
  if (!expiryDate) return <span className="badge badge-neutral">Active</span>;
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
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [targetMedicine, setTargetMedicine] = useState(null);
  const [targetBatchIndex, setTargetBatchIndex] = useState(-1);
  const [batchForm, setBatchForm] = useState({
    batchNumber: "",
    expiryDate: "",
    mrp: "",
    rate: "",
    quantity: "",
  });
  const [batchFormErrors, setBatchFormErrors] = useState({});
  const [savingBatch, setSavingBatch] = useState(false);
  const [deletingBatchKey, setDeletingBatchKey] = useState(null);

  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openAddBatch = (medicine) => {
    setTargetMedicine(medicine);
    setTargetBatchIndex(-1);
    const initialMrp = medicine.mrp != null ? String(medicine.mrp) : "";
    setBatchForm({
      batchNumber: "",
      expiryDate: "",
      mrp: initialMrp,
      rate: String(medicine.rate ?? ""),
      ptr: initialMrp ? String(calcPtr(initialMrp)) : "",
      quantity: "0",
    });
    setBatchFormErrors({});
    setBatchModalOpen(true);
  };

  const openEditBatch = (medicine, batch, batchIdx) => {
    setTargetMedicine(medicine);
    setTargetBatchIndex(batchIdx);
    const mrpStr = String(batch.mrp ?? "");
    setBatchForm({
      batchNumber: batch.batchNumber || "",
      expiryDate: toDateInputValue(batch.expiryDate),
      mrp: mrpStr,
      rate: String(batch.rate ?? ""),
      ptr: String(batch.ptr ?? (mrpStr ? calcPtr(mrpStr) : "")),
      quantity: String(batch.quantity ?? 0),
    });
    setBatchFormErrors({});
    setBatchModalOpen(true);
  };

  const handleSaveBatch = async (e) => {
    e.preventDefault();
    const isEditingBatch = targetBatchIndex >= 0;
    const originalBatchNumber = isEditingBatch
      ? targetMedicine.batches?.[targetBatchIndex]?.batchNumber
      : null;

    setSavingBatch(true);
    try {
      // Re-fetch right before writing so this merges onto current stock, not
      // a snapshot from whenever the list was last loaded - another sale or
      // edit could have changed this medicine's batches in the meantime.
      const fresh = await medicinesApi.get(targetMedicine._id);
      const freshBatches = [...(fresh.data.batches || [])];

      let excludeIndex = -1;
      if (isEditingBatch) {
        excludeIndex = freshBatches.findIndex(
          (b) => (b.batchNumber || "").toLowerCase() === (originalBatchNumber || "").toLowerCase(),
        );
        if (excludeIndex === -1) {
          toast.error("This batch no longer exists - it may have changed elsewhere. Refreshing the list.");
          setBatchModalOpen(false);
          fetchItems();
          return;
        }
      }

      const errors = validateBatchForm(batchForm, { existingBatches: freshBatches, excludeIndex });
      setBatchFormErrors(errors);
      if (hasErrors(errors)) {
        toast.error("Please fix the highlighted fields.");
        return;
      }

      const newBatchData = {
        batchNumber: batchForm.batchNumber.trim(),
        expiryDate: new Date(batchForm.expiryDate).toISOString(),
        mrp: Number(batchForm.mrp) || 0,
        rate: Number(batchForm.rate) || 0,
        ptr: calcPtr(batchForm.mrp),
        quantity: Number(batchForm.quantity) || 0,
      };

      if (isEditingBatch) {
        freshBatches[excludeIndex] = { ...freshBatches[excludeIndex], ...newBatchData };
      } else {
        freshBatches.push(newBatchData);
      }

      await medicinesApi.update(targetMedicine._id, { batches: freshBatches });
      toast.success(isEditingBatch ? "Batch updated successfully!" : "New batch added successfully!");
      setBatchModalOpen(false);
      fetchItems();
    } catch (err) {
      toast.error(err.message || "Failed to save batch");
    } finally {
      setSavingBatch(false);
    }
  };

  const handleDeleteBatch = async (medicine, batchIdx) => {
    const batch = medicine.batches?.[batchIdx];
    const batchNumber = batch?.batchNumber;
    if ((medicine.batches?.length || 0) <= 1) {
      toast.error(
        "Can't delete a medicine's only batch here - delete the medicine itself if you want to remove it entirely.",
      );
      return;
    }
    if (!confirm(`Delete batch "${batchNumber || "Selected"}" from ${medicine.name}?`)) return;

    const key = `${medicine._id}:${batchNumber}`;
    setDeletingBatchKey(key);
    try {
      // Re-fetch and locate the batch by number rather than trusting the
      // stale index, in case another edit changed the batch order/count.
      const fresh = await medicinesApi.get(medicine._id);
      const freshBatches = fresh.data.batches || [];
      if (freshBatches.length <= 1) {
        toast.error("This is now the medicine's only batch - delete the medicine itself instead.");
        fetchItems();
        return;
      }
      const freshIdx = freshBatches.findIndex(
        (b) => (b.batchNumber || "").toLowerCase() === (batchNumber || "").toLowerCase(),
      );
      if (freshIdx === -1) {
        toast.error("This batch no longer exists - it may have already been removed elsewhere.");
        fetchItems();
        return;
      }
      const updatedBatches = freshBatches.filter((_, i) => i !== freshIdx);
      await medicinesApi.update(medicine._id, { batches: updatedBatches });
      toast.success(`Batch ${batchNumber || ""} deleted`);
      fetchItems();
    } catch (err) {
      toast.error(err.message || "Failed to delete batch");
    } finally {
      setDeletingBatchKey(null);
    }
  };

  const fetchItems = useCallback(() => {
    setLoading(true);
    const params = { page, limit };
    if (search) params.name = search;

    medicinesApi
      .list(params)
      .then((res) => {
        setItems(res.data.items);
        setPagination(res.data.pagination);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [page, limit, search, toast]);

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
      name: item.name || "",
      expiryDate: toDateInputValue(item.expiryDate),
      packagingType: item.packagingType || "",
      mrp: String(item.mrp ?? ""),
      rate: String(item.rate ?? ""),
      quantity: String(item.quantity ?? 0),
      batchNumber: item.batchNumber || "",
      manufacturer: item.manufacturer || "",
      hsn: item.hsn || "",
      gstRate: String(item.gstRate ?? 5),
      description: item.description || "",
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => clearFieldError(prev, name));
  };

  const handleDelete = async (id) => {
    const item = items.find((i) => i._id === id);
    const count = item?.batches?.length || 1;
    if (!confirm(`Delete medicine master product "${item?.name || ""}" and all its ${count} batch(es)?`)) return;
    try {
      const res = await medicinesApi.remove(id);
      toast.success(res.message);
      fetchItems();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateMedicineForm(form, { isEditing: !!editing });
    const isSingleBatchEdit = editing && (editing.batches?.length || 1) <= 1;
    const isCreating = !editing;

    // Bypass batch validation only when editing a multi-batch medicine
    if (editing && !isSingleBatchEdit) {
      delete errors.expiryDate;
      delete errors.mrp;
      delete errors.rate;
    }

    setFormErrors(errors);
    if (hasErrors(errors)) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);

    const parsedDate = new Date(form.expiryDate);
    const validExpiry = Number.isNaN(parsedDate.getTime())
      ? new Date().toISOString()
      : parsedDate.toISOString();

    const payload = (isCreating || isSingleBatchEdit)
      ? {
          name: form.name,
          expiryDate: validExpiry,
          packagingType: form.packagingType,
          mrp: Number(form.mrp),
          rate: Number(form.rate),
          ptr: calcPtr(form.mrp),
          quantity: Number(form.quantity) || 0,
          batchNumber: form.batchNumber || undefined,
          manufacturer: form.manufacturer || undefined,
          hsn: form.hsn || undefined,
          gstRate: Number(form.gstRate) || 5,
          description: form.description || undefined,
          ...(editing && editing.batches && editing.batches.length === 1
            ? {
                batches: [
                  {
                    ...editing.batches[0],
                    batchNumber: form.batchNumber || editing.batches[0].batchNumber,
                    expiryDate: validExpiry,
                    mrp: Number(form.mrp),
                    rate: Number(form.rate),
                    ptr: calcPtr(form.mrp),
                    quantity: Number(form.quantity) || 0,
                  },
                ],
              }
            : {}),
        }
      : {
          name: form.name,
          packagingType: form.packagingType,
          manufacturer: form.manufacturer || undefined,
          hsn: form.hsn || undefined,
          gstRate: Number(form.gstRate) || 5,
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
          <div className="loading">
            <LottieLoader message="Loading inventory..." compact />
          </div>
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
                    <th>GST</th>
                    <th>PTR</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const batchList = item.batches && item.batches.length > 0 ? item.batches : [];
                    const batchCount = batchList.length > 0 ? batchList.length : 1;
                    const hasMultipleBatches = batchCount > 1;
                    const isExpanded = hasMultipleBatches && expandedRows.has(item._id);
                    const mrpRange = batchRange(batchList, "mrp");
                    const rateRange = batchRange(batchList, "rate");
                    const ptrRange = batchRange(batchList, "ptr");

                    return (
                      <Fragment key={item._id}>
                        <tr>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {hasMultipleBatches ? (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => toggleRow(item._id)}
                                  style={{ padding: 2, minWidth: "auto" }}
                                  title={isExpanded ? "Hide batch breakdown" : "Show batch breakdown"}
                                >
                                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                              ) : (
                                <span style={{ display: "inline-block", width: 16 }} aria-hidden="true" />
                              )}
                              <div>
                                <div style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "0.9rem" }}>
                                  {item.name}
                                </div>
                                {item.manufacturer && (
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "var(--text-muted)",
                                      marginTop: 2,
                                    }}
                                  >
                                    {item.manufacturer}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>{item.packagingType}</td>
                          <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{item.hsn || "—"}</td>
                          <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                            {hasMultipleBatches ? (
                              <button
                                type="button"
                                className="badge badge-neutral"
                                style={{ cursor: "pointer", border: "none" }}
                                onClick={() => toggleRow(item._id)}
                              >
                                {batchCount} batches
                              </button>
                            ) : (
                              item.batchNumber || "—"
                            )}
                          </td>
                          <td title={hasMultipleBatches ? "Nearest expiry across all batches" : undefined}>
                            {formatDate(item.expiryDate)}
                          </td>
                          <td style={{ fontWeight: 600 }}>{item.quantity}</td>
                          <td>{mrpRange ? formatRange(mrpRange) : formatCurrency(item.mrp)}</td>
                          <td>{rateRange ? formatRange(rateRange) : formatCurrency(item.rate)}</td>
                          <td>{item.gstRate ?? 5}%</td>
                          <td>{ptrRange ? formatRange(ptrRange) : formatCurrency(item.ptr)}</td>
                          <td>{getExpiryBadge(item.expiryDate)}</td>
                          <td>
                            <div className="actions-cell">
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => openEdit(item)}
                                aria-label="Edit medicine"
                                title="Edit Medicine"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleDelete(item._id)}
                                aria-label="Delete medicine"
                                title="Delete Medicine"
                              >
                                <Trash2 size={15} color="var(--danger)" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ background: "var(--surface-elevated, #f8fafc)" }}>
                            <td colSpan={12} style={{ padding: "12px 16px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)" }}>
                                  Active Batches ({batchCount})
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => openAddBatch(item)}
                                  style={{ fontSize: "0.75rem", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
                                >
                                  <Plus size={13} /> Add Batch
                                </button>
                              </div>
                              <table style={{ width: "100%", fontSize: "0.8rem" }}>
                                <thead>
                                  <tr style={{ background: "var(--bg-muted, #f1f5f9)" }}>
                                    <th>Batch No.</th>
                                    <th>Expiry Date</th>
                                    <th>MRP</th>
                                    <th>Rate</th>
                                    <th>PTR</th>
                                    <th>Stock Qty</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: "right" }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {batchList.map((b, idx) => {
                                    const isDeletingThis = deletingBatchKey === `${item._id}:${b.batchNumber}`;
                                    return (
                                      <tr key={b._id || idx}>
                                        <td style={{ fontFamily: "monospace", fontWeight: 600 }}>
                                          {b.batchNumber || "—"}
                                        </td>
                                        <td>{formatDate(b.expiryDate)}</td>
                                        <td>{formatCurrency(b.mrp)}</td>
                                        <td>{formatCurrency(b.rate)}</td>
                                        <td>{formatCurrency(b.ptr)}</td>
                                        <td style={{ fontWeight: 700 }}>{b.quantity}</td>
                                        <td>{getExpiryBadge(b.expiryDate)}</td>
                                        <td>
                                          <div className="actions-cell" style={{ justifyContent: "flex-end" }}>
                                            <button
                                              type="button"
                                              className="btn btn-ghost btn-sm"
                                              onClick={() => openEditBatch(item, b, idx)}
                                              aria-label="Edit batch"
                                              title="Edit batch"
                                              disabled={isDeletingThis}
                                            >
                                              <Pencil size={14} />
                                            </button>
                                            <button
                                              type="button"
                                              className="btn btn-ghost btn-sm"
                                              onClick={() => handleDeleteBatch(item, idx)}
                                              aria-label="Delete batch"
                                              title="Delete batch"
                                              disabled={isDeletingThis}
                                            >
                                              <Trash2 size={14} color="var(--danger)" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
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
              itemLabel="items"
            />
          </>
        )}
      </div>

      {modalOpen && (
        <Modal
          title={editing ? `Edit Medicine: ${editing.name}` : "Add Medicine Product"}
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
                {saving ? "Saving..." : editing ? "Update Medicine" : "Create Product"}
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
              <label>Manufacturer</label>
              <input
                name="manufacturer"
                value={form.manufacturer}
                onChange={handleChange}
              />
            </div>
            <div className="input-group">
              <label>GST Rate (%) *</label>
              <select
                name="gstRate"
                value={form.gstRate}
                onChange={handleChange}
                required
              >
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

            {!editing || (editing.batches?.length || 1) <= 1 ? (
              <>
                <div className="input-group">
                  <label>Batch Number</label>
                  <input
                    name="batchNumber"
                    value={form.batchNumber}
                    onChange={handleChange}
                    placeholder="e.g. B-01"
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
                  <label>Rate (₹) *</label>
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
                    className={fieldClass(formErrors, "quantity")}
                  />
                  <FieldError message={formErrors.quantity} />
                </div>
                {editing && (
                  <div className="full-width" style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setModalOpen(false);
                        openAddBatch(editing);
                      }}
                      style={{ fontSize: "0.8rem" }}
                    >
                      <Plus size={14} /> Add Another Batch To This Medicine
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div
                className="full-width"
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--surface-elevated)",
                  fontSize: "0.825rem",
                  color: "var(--text-muted)",
                  marginTop: 6,
                }}
              >
                ℹ️ This product has {editing.batches.length} active batches. Batch numbers, expiry dates, MRP, rate, and quantities are managed per batch under the <strong>Batches Breakdown</strong> table.
              </div>
            )}

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

      {batchModalOpen && (
        <Modal
          title={targetBatchIndex >= 0 ? `Edit Batch: ${batchForm.batchNumber}` : `Add New Batch for ${targetMedicine?.name}`}
          onClose={() => setBatchModalOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setBatchModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveBatch}
                disabled={savingBatch}
              >
                {savingBatch ? "Saving..." : targetBatchIndex >= 0 ? "Update Batch" : "Add Batch"}
              </button>
            </>
          }
        >
          <form onSubmit={handleSaveBatch} className="form-grid">
            <div className="input-group">
              <label>Batch Number *</label>
              <input
                value={batchForm.batchNumber}
                onChange={(e) => {
                  setBatchForm((prev) => ({ ...prev, batchNumber: e.target.value }));
                  setBatchFormErrors((prev) => clearFieldError(prev, "batchNumber"));
                }}
                placeholder="e.g. B-101"
                className={fieldClass(batchFormErrors, "batchNumber")}
              />
              <FieldError message={batchFormErrors.batchNumber} />
            </div>
            <div className="input-group">
              <label>Expiry Date *</label>
              <input
                type="date"
                value={batchForm.expiryDate}
                onChange={(e) => {
                  setBatchForm((prev) => ({ ...prev, expiryDate: e.target.value }));
                  setBatchFormErrors((prev) => clearFieldError(prev, "expiryDate"));
                }}
                className={fieldClass(batchFormErrors, "expiryDate")}
              />
              <FieldError message={batchFormErrors.expiryDate} />
            </div>
            <div className="input-group">
              <label>MRP (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={batchForm.mrp}
                onChange={(e) => {
                  const val = e.target.value;
                  setBatchForm((prev) => ({
                    ...prev,
                    mrp: val,
                    ptr: String(calcPtr(val)),
                  }));
                  setBatchFormErrors((prev) => clearFieldError(prev, "mrp"));
                }}
                className={fieldClass(batchFormErrors, "mrp")}
              />
              <FieldError message={batchFormErrors.mrp} />
            </div>
            <div className="input-group">
              <label>Rate (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={batchForm.rate}
                onChange={(e) => {
                  setBatchForm((prev) => ({ ...prev, rate: e.target.value }));
                  setBatchFormErrors((prev) => clearFieldError(prev, "rate"));
                }}
                className={fieldClass(batchFormErrors, "rate")}
              />
              <FieldError message={batchFormErrors.rate} />
            </div>
            <div className="input-group">
              <label>PTR (₹)</label>
              <input
                type="text"
                value={batchForm.mrp ? formatCurrency(calcPtr(batchForm.mrp)) : "—"}
                readOnly
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Auto-calculated: MRP − 23.8%
              </span>
            </div>
            <div className="input-group">
              <label>Stock Quantity *</label>
              <input
                type="number"
                min="0"
                value={batchForm.quantity}
                onChange={(e) => {
                  setBatchForm((prev) => ({ ...prev, quantity: e.target.value }));
                  setBatchFormErrors((prev) => clearFieldError(prev, "quantity"));
                }}
                className={fieldClass(batchFormErrors, "quantity")}
              />
              <FieldError message={batchFormErrors.quantity} />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
