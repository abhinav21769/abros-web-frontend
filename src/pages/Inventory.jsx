import { useCallback, useEffect, useState, Fragment } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  Search,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { FadeIn } from "../components/ui/fade-in";
import Pagination from "../components/ui/Pagination";
import Modal from "../components/ui/Modal";
import useFormRoute from "../hooks/useFormRoute";
import FieldError from "../components/ui/FieldError";
import LottieLoader from "../components/ui/LottieLoader";
import { medicinesApi } from "../api/client";
import { useToast } from "../context/ToastContext";
import { GST_RATE_OPTIONS } from "../utils/invoiceTax";
import { formatCalendarDate, toDateInputValue } from "../utils/dateUtils";
import { formatNumber } from "../utils/customerSales";
import {
  batchOverview,
  batchRange,
  expiryStatus,
  medicineExpiry,
  stockLevel,
  stockShare,
} from "../utils/inventoryView";
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

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value) || 0);
}

function formatRange(range) {
  return `${formatCurrency(range.min)} – ${formatCurrency(range.max)}`;
}

function BatchPanel({ item, batches, now, deletingBatchKey, onAdd, onEdit, onDelete }) {
  const overview = batchOverview(batches, now);

  return (
    <div className="inv-batches" id={`batches-${item._id}`}>
      <div className="inv-batches-head">
        <div className="inv-batches-summary">
          <strong>
            {overview.count} batches · {formatNumber(overview.totalUnits)} units
          </strong>
          {overview.nearestStatus && (
            <span>
              Nearest expiry {formatCalendarDate(overview.nearestDate)}
              <span className={`inv-chip inv-chip-${overview.nearestStatus.tone}`}>
                {overview.nearestStatus.label}
              </span>
            </span>
          )}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAdd(item)}>
          <Plus size={13} /> Add batch
        </button>
      </div>

      <div className="inv-batches-scroll">
        <table>
          <thead>
            <tr>
              <th>Batch</th>
              <th>Expiry</th>
              <th>Stock</th>
              <th className="num">MRP</th>
              <th className="num">Rate</th>
              <th className="num">PTR</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {batches.map((batch, idx) => {
              const isDeleting = deletingBatchKey === `${item._id}:${batch.batchNumber}`;
              const status = expiryStatus(batch.expiryDate, now);
              const isEmpty = !(Number(batch.quantity) > 0);
              const share = stockShare(batch.quantity, overview.totalUnits);

              return (
                <tr key={batch._id || idx} className={isEmpty ? "is-empty" : undefined}>
                  <td>
                    <span className="inv-mono inv-strong">{batch.batchNumber || "—"}</span>
                    {idx === overview.nextIndex && (
                      <span
                        className="inv-chip inv-chip-info"
                        title="Sales without a chosen batch draw from the earliest-expiring batch with stock first (FEFO)."
                      >
                        Sells first
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="inv-date">{formatCalendarDate(batch.expiryDate) || "—"}</div>
                    <span className={`inv-chip inv-chip-${status.tone}`}>{status.label}</span>
                  </td>
                  <td>
                    <div className="inv-stock-cell">
                      <span className="inv-strong">{formatNumber(batch.quantity)}</span>
                      {isEmpty ? (
                        <span className="inv-chip inv-chip-neutral">Empty</span>
                      ) : (
                        <span className="inv-stock-bar" title={`${share}% of this medicine's stock`}>
                          <span style={{ width: `${share}%` }} />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="num">{formatCurrency(batch.mrp)}</td>
                  <td className="num">{formatCurrency(batch.rate)}</td>
                  <td className="num">{formatCurrency(batch.ptr)}</td>
                  <td>
                    <div className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => onEdit(item, batch, idx)}
                        aria-label={`Edit batch ${batch.batchNumber || ""}`}
                        title="Edit batch"
                        disabled={isDeleting}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => onDelete(item, idx)}
                        aria-label={`Delete batch ${batch.batchNumber || ""}`}
                        title="Delete batch"
                        disabled={isDeleting}
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
      </div>
    </div>
  );
}

export default function Inventory() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
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

  const prepareAddBatch = (medicine) => {
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
  };

  const prepareEditBatch = (medicine, batch, batchIdx) => {
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
  };

  const prepareCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormErrors({});
  };

  const prepareEdit = (item) => {
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
  };

  // On mobile each form is a page: /inventory/new, /inventory/:id/edit,
  // /inventory/:id/batches/new and /inventory/:id/batches/:index/edit. The list
  // stays mounted behind it, so search, paging and expanded rows survive.
  const nav = useFormRoute("/inventory", async ([id, kind, third, fourth], { close }) => {
    if (id === "new") {
      prepareCreate();
      return;
    }
    try {
      const res = await medicinesApi.get(id);
      const medicine = res.data;
      if (kind === "edit") {
        prepareEdit(medicine);
      } else if (kind === "batches" && third === "new") {
        prepareAddBatch(medicine);
      } else if (kind === "batches" && fourth === "edit") {
        const batchIdx = Number(third);
        const batch = medicine.batches?.[batchIdx];
        if (!batch) throw new Error("That batch no longer exists.");
        prepareEditBatch(medicine, batch, batchIdx);
      }
    } catch (err) {
      toast.error(err.message);
      close();
    }
  });
  const [routeId, routeKind, routeThird] = nav.segments;
  const formRouteActive = routeId === "new" || routeKind === "edit";
  const batchRouteActive = routeKind === "batches";
  const routeFormReady = routeKind !== "edit" || editing?._id === routeId;
  const routeBatchReady =
    !batchRouteActive ||
    (targetMedicine?._id === routeId &&
      (routeThird === "new" ? targetBatchIndex === -1 : targetBatchIndex === Number(routeThird)));
  const formOpen =
    (nav.isMobile ? formRouteActive : modalOpen || formRouteActive) && routeFormReady;
  const batchFormOpen =
    (nav.isMobile ? batchRouteActive : batchModalOpen || batchRouteActive) && routeBatchReady;

  // `replace` swaps the current form page for the batch page instead of
  // stacking one on top of the other.
  const openAddBatch = (medicine, replace = false) => {
    prepareAddBatch(medicine);
    if (nav.isMobile || replace) {
      const sub = `${medicine._id}/batches/new`;
      if (replace) nav.replace(sub);
      else nav.open(sub);
    } else {
      setBatchModalOpen(true);
    }
  };

  const openEditBatch = (medicine, batch, batchIdx) => {
    prepareEditBatch(medicine, batch, batchIdx);
    if (nav.isMobile) nav.open(`${medicine._id}/batches/${batchIdx}/edit`);
    else setBatchModalOpen(true);
  };

  const closeBatchForm = () => {
    setBatchModalOpen(false);
    if (batchRouteActive) nav.close();
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
          closeBatchForm();
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
      closeBatchForm();
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

  // Wait for a pause in typing before searching instead of querying on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const openCreate = () => {
    prepareCreate();
    if (nav.isMobile) nav.open("new");
    else setModalOpen(true);
  };

  const openEdit = (item) => {
    prepareEdit(item);
    if (nav.isMobile) nav.open(`${item._id}/edit`);
    else setModalOpen(true);
  };

  const closeForm = () => {
    setModalOpen(false);
    if (formRouteActive) nav.close();
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
      closeForm();
      fetchItems();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const now = new Date();

  return (
    <>
      <PageHeader
        title="Inventory"
        action={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add Medicine
          </button>
        }
      />
      <p className="inv-subtitle">
        Medicine stock, batches, expiry dates and pricing. Quantities are totals across all batches.
      </p>

      <FadeIn className="card inv-card" delay={0.08}>
        <div className="inv-toolbar">
          <label className="inv-search">
            <Search size={15} />
            <input
              type="search"
              placeholder="Search by medicine name"
              aria-label="Search medicines by name"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </label>
          {pagination && (
            <span className="inv-count">
              {pagination.totalItems} {pagination.totalItems === 1 ? "medicine" : "medicines"}
              {search ? ` matching "${search}"` : ""}
            </span>
          )}
        </div>

        {loading && items.length === 0 ? (
          <div className="loading">
            <LottieLoader message="Loading inventory..." compact />
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            {search ? `No medicines match "${search}".` : "No medicines in inventory yet."}
          </div>
        ) : (
          <div className={`inv-body${loading ? " is-loading" : ""}`} aria-busy={loading}>
            <div className="table-wrap">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Batch</th>
                    <th>Expiry</th>
                    <th className="num">Stock</th>
                    <th className="num">Pricing</th>
                    <th>GST · HSN</th>
                    <th aria-label="Actions" />
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
                    const expiry = medicineExpiry(item, now);
                    const level = stockLevel(item.quantity);

                    return (
                      <Fragment key={item._id}>
                        <tr className={isExpanded ? "is-open" : undefined}>
                          <td>
                            <div className="inv-medicine">
                              {hasMultipleBatches ? (
                                <button
                                  type="button"
                                  className={`inv-chevron${isExpanded ? " is-open" : ""}`}
                                  onClick={() => toggleRow(item._id)}
                                  aria-expanded={isExpanded}
                                  aria-controls={`batches-${item._id}`}
                                  title={isExpanded ? "Hide batches" : "Show batches"}
                                >
                                  <ChevronRight size={16} />
                                </button>
                              ) : (
                                <span className="inv-chevron-spacer" aria-hidden="true" />
                              )}
                              <div>
                                <div className="inv-name">{item.name}</div>
                                <div className="inv-meta">
                                  {[item.manufacturer, item.packagingType].filter(Boolean).join(" · ") || "—"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            {hasMultipleBatches ? (
                              <button
                                type="button"
                                className={`inv-batch-pill${isExpanded ? " is-open" : ""}`}
                                onClick={() => toggleRow(item._id)}
                                aria-expanded={isExpanded}
                                aria-controls={`batches-${item._id}`}
                              >
                                {batchCount} batches
                                <ChevronRight size={13} />
                              </button>
                            ) : (
                              <span className="inv-mono">{item.batchNumber || "—"}</span>
                            )}
                          </td>
                          <td title={hasMultipleBatches ? "Nearest expiry across batches with stock" : undefined}>
                            <div className="inv-date">{formatCalendarDate(expiry.date || item.expiryDate) || "—"}</div>
                            <span className={`inv-chip inv-chip-${expiry.tone}`}>{expiry.label}</span>
                          </td>
                          <td className="num">
                            <div className="inv-qty">{formatNumber(item.quantity)}</div>
                            {level !== "ok" && (
                              <span className={`inv-chip inv-chip-${level === "out" ? "danger" : "warning"}`}>
                                {level === "out" ? "Out of stock" : "Low stock"}
                              </span>
                            )}
                          </td>
                          <td className="num">
                            <div className="inv-price">
                              {mrpRange ? formatRange(mrpRange) : formatCurrency(item.mrp)}
                            </div>
                            <div className="inv-meta">
                              Rate {rateRange ? formatRange(rateRange) : formatCurrency(item.rate)}
                              {" · "}PTR {ptrRange ? formatRange(ptrRange) : formatCurrency(item.ptr)}
                            </div>
                          </td>
                          <td>
                            <div className="inv-date">{item.gstRate ?? 5}%</div>
                            <div className="inv-meta inv-mono">{item.hsn || "—"}</div>
                          </td>
                          <td>
                            <div className="actions-cell">
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => openEdit(item)}
                                aria-label={`Edit ${item.name}`}
                                title="Edit medicine"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleDelete(item._id)}
                                aria-label={`Delete ${item.name}`}
                                title="Delete medicine"
                              >
                                <Trash2 size={15} color="var(--danger)" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="inv-batches-row">
                            <td colSpan={7}>
                              <BatchPanel
                                item={item}
                                batches={batchList}
                                now={now}
                                deletingBatchKey={deletingBatchKey}
                                onAdd={openAddBatch}
                                onEdit={openEditBatch}
                                onDelete={handleDeleteBatch}
                              />
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
          </div>
        )}
      </FadeIn>

      {formOpen && (
        <Modal
          title={editing ? `Edit Medicine: ${editing.name}` : "Add Medicine Product"}
          onClose={closeForm}
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={closeForm}
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
                        openAddBatch(editing, formRouteActive);
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

      {batchFormOpen && (
        <Modal
          title={targetBatchIndex >= 0 ? `Edit Batch: ${batchForm.batchNumber}` : `Add New Batch for ${targetMedicine?.name}`}
          onClose={closeBatchForm}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeBatchForm}
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
