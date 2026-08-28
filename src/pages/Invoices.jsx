import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import logger from "../utils/logger";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Download,
  Eye,
  Printer,
  Share2,
  ChevronDown,
  Search,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import Modal from "../components/ui/Modal";
import FieldError from "../components/ui/FieldError";
import LottieLoader from "../components/ui/LottieLoader";
import InvoicePreviewModal from "../components/InvoicePreviewModal";
import AddMedicineModal from "../components/AddMedicineModal";
import { invoicesApi, customersApi, medicinesApi } from "../api/client";
import { useToast } from "../context/ToastContext";
import {
  downloadInvoicePdf,
  printInvoicePdf,
  shareInvoicePdf,
} from "../utils/invoiceExport";
import {
  formatCalendarDate,
  formatDateTime,
  getTodayDateInputValue,
  toDateInputValue,
  toInvoiceDatePayload,
} from "../utils/dateUtils";

import { calculateInvoiceTax, GST_RATE_OPTIONS } from "../utils/invoiceTax";
import { getAvailableStockForLine } from "../utils/invoiceStock";
import {
  clearFieldError,
  fieldClass,
  hasErrors,
  validateInvoiceForm,
} from "../utils/formValidation";

function makeEmptyItem() {
  return {
    _key: Math.random().toString(36).substring(2, 9),
    medicine: "",
    medicineName: "",
    batchNumber: "",
    expiryDate: "",
    mrp: "",
    hsn: "",
    gstRate: "5",
    discount: "0",
    quantity: "1",
    free: "0",
    ptr: "",
    rate: "",
  };
}

const emptyForm = {
  invoiceNumber: "",
  customer: "",
  supplier: "",
  supplierAddress: "",
  supplierContact: "",
  supplierDlNo: "",
  supplierGstin: "",
  status: "pending",
  paymentType: "credit",
  invoiceDate: getTodayDateInputValue(),
  items: [makeEmptyItem()],
};

const INVOICE_TABS = [
  { id: "sale", label: "Sale" },
  { id: "purchase", label: "Purchase" },
];

function resolveInvoiceType(value) {
  return value === "purchase" ? "purchase" : "sale";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value) || 0);
}

function QuickStatusBadge({ item, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const dropdownRef = useRef(null);

  const status = item?.status || "pending";
  const isPending = String(status).toLowerCase() === "pending";
  const isPaid = String(status).toLowerCase() === "paid";
  const paidDateVal = item?.paidAt || (isPaid ? (item?.updatedAt || item?.invoiceDate) : null);
  const formattedDate = paidDateVal ? formatDateTime(paidDateVal) : "";

  const map = {
    paid: "badge-success",
    pending: "badge-warning",
    cancelled: "badge-danger",
  };

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [open]);

  // Non-pending statuses render standard badge without dropdown
  if (!isPending) {
    return (
      <span
        className={`badge ${map[status] || "badge-neutral"}${isPaid && formattedDate ? " badge-has-tooltip" : ""}`}
        title={isPaid && formattedDate ? `Paid on: ${formattedDate}` : undefined}
        style={isPaid ? { cursor: "pointer" } : undefined}
      >
        {status}
        {isPaid && formattedDate && (
          <span className="badge-tooltip">Paid on: {formattedDate}</span>
        )}
      </span>
    );
  }

  const handleSelectStatus = async (newStatus) => {
    setOpen(false);
    if (newStatus === status) return;
    setUpdating(true);
    try {
      await onStatusChange(item._id, newStatus);
    } catch (err) {
      logger.error("Invoice status update failed", err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        position: "relative",
        display: "inline-block",
        zIndex: open ? 99999 : 1,
      }}
    >
      <button
        type="button"
        className={`badge ${map[status] || "badge-neutral"}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        disabled={updating}
        title="Click to change status"
        style={{
          border: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontFamily: "inherit",
        }}
      >
        <span>{updating ? "..." : status}</span>
        <ChevronDown size={11} style={{ opacity: 0.8 }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 999999,
            background: "var(--surface)",
            border: "1px solid var(--border-strong, var(--border))",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
            padding: "4px",
            minWidth: "120px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {["pending", "paid", "cancelled"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectStatus(st);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 10px",
                fontSize: "0.78rem",
                fontWeight: st === status ? 700 : 500,
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: st === status ? "var(--surface-elevated)" : "transparent",
                color: "var(--text-main)",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                textTransform: "capitalize",
              }}
            >
              <span className={`badge ${map[st]}`} style={{ padding: "2px 6px", fontSize: "0.68rem" }}>
                {st}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerSearchSelect({ customers, value, onChange, hasError }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c._id === value),
    [customers, value]
  );

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const term = search.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.contact && c.contact.toLowerCase().includes(term)) ||
        (c.gstin && c.gstin.toLowerCase().includes(term))
    );
  }, [customers, search]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="searchable-select-wrap">
      <button
        type="button"
        className={`searchable-select-trigger ${hasError ? "has-error" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>
          {selectedCustomer
            ? `${selectedCustomer.name}${selectedCustomer.contact ? ` (${selectedCustomer.contact})` : ""}`
            : "Select customer..."}
        </span>
        <Search size={15} className="searchable-select-icon" />
      </button>

      {isOpen && (
        <div className="searchable-select-dropdown">
          <div className="searchable-select-search-box">
            <Search size={14} className="searchable-select-search-icon" />
            <input
              type="text"
              autoFocus
              placeholder="Search customer by name, phone, GSTIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="searchable-select-input"
            />
            {search && (
              <button
                type="button"
                className="searchable-select-clear"
                onClick={() => setSearch("")}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="searchable-select-options">
            {filteredCustomers.length === 0 ? (
              <div className="searchable-select-no-results">
                No customer found matching "{search}"
              </div>
            ) : (
              filteredCustomers.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  className={`searchable-select-option ${c._id === value ? "is-selected" : ""}`}
                  onClick={() => {
                    onChange({ target: { name: "customer", value: c._id } });
                    setIsOpen(false);
                  }}
                >
                  <div className="searchable-select-option-main">{c.name}</div>
                  {(c.contact || c.gstin) && (
                    <div className="searchable-select-option-sub">
                      {[c.contact, c.gstin ? `GST: ${c.gstin}` : null]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function paymentTypeLabel(paymentType) {
  return paymentType === "cash" ? "Cash" : "Credit";
}

function getMedicineDefaultRate(med, invoiceType = "sale") {
  if (invoiceType === "purchase") {
    return med?.rate ?? med?.mrp ?? "";
  }
  if (med?.ptr != null && med.ptr !== "") return med.ptr;
  return med?.rate ?? med.mrp ?? "";
}

// The batch a sale line draws from when no batch is picked explicitly (FEFO).
function pickActiveBatch(med) {
  const batches = med?.batches || [];
  return batches.find((b) => b.quantity > 0) || batches[0] || null;
}

// PTR shown alongside the billed rate, for reference.
function getBatchPtr(batch, med) {
  if (batch?.ptr != null && batch.ptr !== "") return batch.ptr;
  if (med?.ptr != null && med.ptr !== "") return med.ptr;
  return "";
}

export default function Invoices() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = resolveInvoiceType(searchParams.get("type"));
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [newMedicineLineIndex, setNewMedicineLineIndex] = useState(null);
  const [invoiceType, setInvoiceType] = useState(tabFromUrl);
  const isPurchase = invoiceType === "purchase";

  useEffect(() => {
    setInvoiceType(tabFromUrl);
    setPage(1);
    setSearch("");
  }, [tabFromUrl]);

  const fetchItems = useCallback(() => {
    setLoading(true);
    const params = { page, limit, invoiceType };
    if (search) params.search = search;

    invoicesApi
      .list(params)
      .then((res) => {
        setItems(res.data.items);
        setPagination(res.data.pagination);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [page, limit, search, invoiceType, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const loadFormData = async (type = invoiceType) => {
    const [allCustomers, allMedicines, numRes] = await Promise.all([
      customersApi.listAll(),
      medicinesApi.listAll({ expired: "false" }),
      invoicesApi.generateNumber(type),
    ]);
    setCustomers(allCustomers);
    setMedicines(allMedicines);
    return {
      invoiceNumber: numRes.data.invoiceNumber,
      medicines: allMedicines,
    };
  };

  const handleTabChange = (type) => {
    setSearchParams(type === "purchase" ? { type: "purchase" } : {}, {
      replace: true,
    });
  };

  const openCreate = async () => {
    try {
      const { invoiceNumber, medicines: activeMedicines } =
        await loadFormData(invoiceType);
      if (activeMedicines.length === 0 && invoiceType !== "purchase") {
        toast.error("Add medicines to inventory before creating an invoice.");
        return;
      }
      setEditing(null);
      setForm({ ...emptyForm, invoiceNumber, items: [makeEmptyItem()] });
      setFormErrors({});
      setModalOpen(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleMedicineCreated = (medicine) => {
    setMedicines((prev) => {
      if (prev.some((item) => item._id === medicine._id)) return prev;
      return [...prev, medicine];
    });

    if (newMedicineLineIndex != null) {
      handleItemChange(newMedicineLineIndex, "medicine", medicine._id);
    }
    setNewMedicineLineIndex(null);
  };

  const openEdit = async (item) => {
    try {
      await loadFormData(item.invoiceType || "sale");
      setEditing(item);
      setForm({
        invoiceNumber: item.invoiceNumber,
        customer: item.customer?._id || item.customer || "",
        supplier: item.supplier || "",
        supplierAddress: item.supplierAddress || "",
        supplierContact: item.supplierContact || "",
        supplierDlNo: item.supplierDlNo || "",
        supplierGstin: item.supplierGstin || "",
        status: item.status,
        paymentType: item.paymentType || "credit",
        invoiceDate: toDateInputValue(item.invoiceDate),
        items: item.items.map((i) => ({
          _key: i._id || Math.random().toString(36).substring(2, 9),
          medicine: i.medicine?._id || i.medicine || "",
          medicineName: i.medicineName,
          batchNumber: i.batchNumber || i.medicine?.batchNumber || "",
          expiryDate: i.expiryDate ? toDateInputValue(i.expiryDate) : (i.medicine?.expiryDate ? toDateInputValue(i.medicine.expiryDate) : ""),
          mrp: String(i.mrp ?? i.medicine?.mrp ?? ""),
          hsn: i.hsn || i.medicine?.hsn || "",
          gstRate: String(i.gstRate ?? i.medicine?.gstRate ?? 5),
          discount: String(i.discount ?? 0),
          quantity: String(i.quantity),
          free: String(i.free ?? 0),
          ptr: String(i.sourceBatch?.ptr ?? i.medicine?.ptr ?? ""),
          rate: String(i.rate),
        })),
      });
      setFormErrors({});
      setModalOpen(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "paymentType"
        ? { status: value === "cash" ? "paid" : "pending" }
        : {}),
    }));
    setFormErrors((prev) => clearFieldError(prev, name));
  };

  const itemFieldError = (index, field) =>
    formErrors[`items.${index}.${field}`];

  const handleItemChange = (index, field, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };

      if (field === "medicine") {
        const med = medicines.find((m) => m._id === value);
        const type = editing?.invoiceType || invoiceType;
        if (med) {
          const activeBatch = pickActiveBatch(med);
          items[index].medicineName = med.name;
          items[index].batchNumber = activeBatch?.batchNumber || med.batchNumber || "";
          items[index].expiryDate = activeBatch?.expiryDate ? toDateInputValue(activeBatch.expiryDate) : (med.expiryDate ? toDateInputValue(med.expiryDate) : "");
          items[index].mrp = String(activeBatch?.mrp ?? med.mrp ?? "");
          items[index].ptr = String(getBatchPtr(activeBatch, med));
          items[index].rate = String(
            activeBatch?.rate ?? getMedicineDefaultRate(med, type),
          );
          items[index].hsn = med.hsn || "";
          items[index].gstRate = String(med.gstRate ?? 5);
        } else {
          items[index].medicineName = "";
          items[index].batchNumber = "";
          items[index].expiryDate = "";
          items[index].mrp = "";
          items[index].ptr = "";
          items[index].rate = "";
          items[index].hsn = "";
          items[index].gstRate = "5";
        }
      }

      if (field === "batchNumber") {
        const med = medicines.find((m) => m._id === items[index].medicine);
        if (med && med.batches && med.batches.length > 0) {
          // No batch picked means FEFO at save time, so mirror that batch here.
          const selectedBatch =
            med.batches.find((b) => b.batchNumber === value) ||
            (value ? null : pickActiveBatch(med));
          if (selectedBatch) {
            items[index].expiryDate = toDateInputValue(selectedBatch.expiryDate);
            items[index].mrp = String(selectedBatch.mrp ?? "");
            items[index].ptr = String(getBatchPtr(selectedBatch, med));
            items[index].rate = String(selectedBatch.rate ?? items[index].rate);
          }
        }
      }

      return { ...prev, items };
    });
    setFormErrors((prev) => clearFieldError(prev, `items.${index}.${field}`));
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, makeEmptyItem()],
    }));
  };

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const taxSummary = useMemo(
    () =>
      calculateInvoiceTax(
        form.items.map((item) => ({
          quantity: Number(item.quantity) || 0,
          rate: Number(item.rate) || 0,
          discount: Number(item.discount) || 0,
          gstRate: Number(item.gstRate) || 5,
        })),
      ),
    [form.items],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const activeType = editing?.invoiceType || invoiceType;
    const errors = validateInvoiceForm(form, {
      medicines,
      editingInvoice: editing,
      invoiceType: activeType,
    });
    setFormErrors(errors);
    if (hasErrors(errors)) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);

    const payload = {
      invoiceNumber: form.invoiceNumber,
      status: form.status,
      paymentType: form.paymentType,
      invoiceDate: toInvoiceDatePayload(form.invoiceDate),
      items: form.items.map((item) => ({
        medicine: item.medicine,
        medicineName: item.medicineName,
        batchNumber: item.batchNumber || undefined,
        expiryDate: item.expiryDate || undefined,
        mrp: item.mrp != null && item.mrp !== "" ? Number(item.mrp) : undefined,
        hsn: item.hsn || undefined,
        discount: Number(item.discount) || 0,
        gstRate: Number(item.gstRate) || 5,
        quantity: Number(item.quantity),
        free: Number(item.free) || 0,
        rate: Number(item.rate),
      })),
    };

    if (activeType === "purchase") {
      payload.invoiceType = "purchase";
      payload.supplier = form.supplier.trim();
      payload.supplierAddress = form.supplierAddress.trim() || undefined;
      payload.supplierContact = form.supplierContact.trim();
      payload.supplierDlNo = form.supplierDlNo.trim()
        ? form.supplierDlNo.trim().toUpperCase()
        : undefined;
      payload.supplierGstin = form.supplierGstin.trim()
        ? form.supplierGstin.trim().toUpperCase()
        : undefined;
    } else {
      payload.invoiceType = "sale";
      payload.customer = form.customer;
    }

    try {
      const res = editing
        ? await invoicesApi.update(editing._id, payload)
        : await invoicesApi.create(payload);
      toast.success(res.message);
      setModalOpen(false);
      fetchItems();

      if (!editing && res?.data) {
        try {
          const detailRes = await invoicesApi.get(res.data._id);
          setPreviewInvoice(detailRes?.data || res.data);
        } catch {
          setPreviewInvoice(res.data);
        }
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this invoice?")) return;
    try {
      const res = await invoicesApi.remove(id);
      toast.success(res.message);
      fetchItems();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleQuickStatusUpdate = async (id, newStatus) => {
    try {
      const res = await invoicesApi.update(id, { status: newStatus });
      toast.success(res.message || `Status updated to ${newStatus}`);
      fetchItems();
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handlePrint = async (invoice) => {
    try {
      const res = await invoicesApi.get(invoice._id);
      const result = await printInvoicePdf(res.data);
      if (result?.method === "open") {
        toast.success("PDF opened — use your browser menu to print.");
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleShare = async (invoice) => {
    try {
      const res = await invoicesApi.get(invoice._id);
      const result = await shareInvoicePdf(res.data);
      if (result.method === "share") {
        toast.success("Invoice shared.");
      } else if (result.method === "share-text") {
        toast.success("Invoice details shared.");
      } else if (result.method === "open") {
        toast.success("PDF opened — use your browser menu to share.");
      } else if (result.method === "download") {
        toast.success("Sharing not supported here — PDF downloaded instead.");
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        toast.error(err.message || "Could not share invoice.");
      }
    }
  };

  const handleDownloadPdf = async (invoice) => {
    try {
      const res = await invoicesApi.get(invoice._id);
      await downloadInvoicePdf(res.data);
      toast.success("Invoice downloaded as PDF.");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const formInvoiceType = editing?.invoiceType || invoiceType;
  const formIsPurchase = formInvoiceType === "purchase";

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={
          isPurchase
            ? "Create and manage purchase invoices from suppliers"
            : "Create and manage sales invoices for customers"
        }
        action={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />{" "}
            {isPurchase ? "New Purchase Invoice" : "New Sale Invoice"}
          </button>
        }
      />

      <div className="card">
        <div className="page-tabs">
          {INVOICE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`page-tab${invoiceType === tab.id ? " active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="toolbar">
          <input
            type="text"
            placeholder={
              isPurchase
                ? "Search by invoice number or supplier..."
                : "Search by invoice number or customer name..."
            }
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {loading ? (
          <div className="loading">
            <LottieLoader message="Loading invoices..." compact />
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            No {isPurchase ? "purchase" : "sale"} invoices found
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>{isPurchase ? "Supplier" : "Customer"}</th>
                    <th>Invoice Date</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <strong>{item.invoiceNumber}</strong>
                      </td>
                      <td>
                        {isPurchase
                          ? item.supplier || "—"
                          : item.customer?.name || "—"}
                      </td>
                      <td>{formatCalendarDate(item.invoiceDate)}</td>
                      <td>{item.items.length}</td>
                      <td>{formatCurrency(item.total)}</td>
                      <td>{paymentTypeLabel(item.paymentType)}</td>
                      <td>
                        <QuickStatusBadge
                          item={item}
                          onStatusChange={handleQuickStatusUpdate}
                        />
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handlePrint(item)}
                            aria-label="Print invoice"
                            title="Print invoice"
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleShare(item)}
                            aria-label="Share invoice"
                            title="Share invoice"
                          >
                            <Share2 size={15} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPreviewInvoice(item)}
                            aria-label="Preview invoice"
                            title="Preview invoice"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDownloadPdf(item)}
                            aria-label="Download PDF"
                            title="Download PDF"
                          >
                            <Download size={15} />
                          </button>
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
              limit={limit}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
              itemLabel="invoices"
            />
          </>
        )}
      </div>

      {modalOpen && (
        <Modal
          title={
            editing
              ? formIsPurchase
                ? "Edit Purchase Invoice"
                : "Edit Sale Invoice"
              : formIsPurchase
                ? "New Purchase Invoice"
                : "New Sale Invoice"
          }
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
                {saving
                  ? "Saving..."
                  : editing
                    ? "Update Invoice"
                    : "Create Invoice"}
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
                <label>Invoice Number *</label>
                <input
                  name="invoiceNumber"
                  value={form.invoiceNumber}
                  onChange={handleChange}
                  className={fieldClass(formErrors, "invoiceNumber")}
                />
                <FieldError message={formErrors.invoiceNumber} />
              </div>
              <div className="input-group">
                <label>Invoice Date *</label>
                <input
                  type="date"
                  name="invoiceDate"
                  value={form.invoiceDate}
                  onChange={handleChange}
                  className={fieldClass(formErrors, "invoiceDate")}
                />
                <FieldError message={formErrors.invoiceDate} />
              </div>
              <div className="input-group">
                <label>Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              {formIsPurchase ? (
                <>
                  <div className="input-group">
                    <label>Supplier Name *</label>
                    <input
                      name="supplier"
                      value={form.supplier}
                      onChange={handleChange}
                      placeholder="Distributor / supplier name"
                      className={fieldClass(formErrors, "supplier")}
                    />
                    <FieldError message={formErrors.supplier} />
                  </div>
                  <div className="input-group">
                    <label>Phone No. *</label>
                    <input
                      name="supplierContact"
                      value={form.supplierContact}
                      onChange={handleChange}
                      placeholder="10-digit mobile"
                      className={fieldClass(formErrors, "supplierContact")}
                    />
                    <FieldError message={formErrors.supplierContact} />
                  </div>
                  <div className="input-group">
                    <label>D.L. No.</label>
                    <input
                      name="supplierDlNo"
                      value={form.supplierDlNo}
                      onChange={handleChange}
                      placeholder="Drug license number"
                      className={fieldClass(formErrors, "supplierDlNo")}
                    />
                    <FieldError message={formErrors.supplierDlNo} />
                  </div>
                  <div className="input-group">
                    <label>GSTIN</label>
                    <input
                      name="supplierGstin"
                      value={form.supplierGstin}
                      onChange={handleChange}
                      placeholder="15-character GSTIN"
                      className={fieldClass(formErrors, "supplierGstin")}
                    />
                    <FieldError message={formErrors.supplierGstin} />
                  </div>
                  <div className="input-group full-width">
                    <label>Address</label>
                    <textarea
                      name="supplierAddress"
                      value={form.supplierAddress}
                      onChange={handleChange}
                      placeholder="Supplier address (optional)"
                      rows={2}
                      className={fieldClass(formErrors, "supplierAddress")}
                    />
                    <FieldError message={formErrors.supplierAddress} />
                  </div>
                </>
              ) : (
                <div className="input-group">
                  <label>Customer *</label>
                  <CustomerSearchSelect
                    customers={customers}
                    value={form.customer}
                    onChange={handleChange}
                    hasError={Boolean(formErrors.customer)}
                  />
                  <FieldError message={formErrors.customer} />
                </div>
              )}
              <div className="input-group">
                <label>Payment Type *</label>
                <select
                  name="paymentType"
                  value={form.paymentType}
                  onChange={handleChange}
                  required
                >
                  <option value="credit">Credit</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
            </div>

            <div className="invoice-items-header">
              <strong>Medicines & Items</strong>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={addItem}
                disabled={!formIsPurchase && medicines.length === 0}
              >
                <Plus size={14} /> Add Medicine
              </button>
            </div>

            <div className="invoice-items">
              {!formIsPurchase && medicines.length === 0 ? (
                <div className="empty-state">
                  No active medicines in inventory. Add medicines first.
                </div>
              ) : (
                form.items.map((item, index) => (
                  <div
                    key={item._key || index}
                    className={`invoice-single-line-item${
                      formIsPurchase ? "" : " invoice-single-line-item--sale"
                    }`}
                  >
                    <div className="input-group input-group-medicine">
                      <div className="input-group-header-row">
                        <label>Medicine *</label>
                        {!formIsPurchase &&
                        item.medicine &&
                        form.status !== "cancelled" ? (
                          <span
                            className={`invoice-stock-badge${
                              getAvailableStockForLine({
                                formItems: form.items,
                                medicines,
                                lineIndex: index,
                                editingInvoice: editing,
                                formStatus: form.status,
                              }) === 0
                                ? " invoice-stock-badge--empty"
                                : ""
                            }`}
                          >
                            Avail:{" "}
                            {getAvailableStockForLine({
                              formItems: form.items,
                              medicines,
                              lineIndex: index,
                              editingInvoice: editing,
                              formStatus: form.status,
                            })}
                          </span>
                        ) : null}
                      </div>
                      <div className="medicine-select-row">
                        <select
                          value={item.medicine}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "medicine",
                              e.target.value,
                            )
                          }
                          className={fieldClass(
                            formErrors,
                            `items.${index}.medicine`,
                          )}
                        >
                          <option value="">
                            {medicines.length === 0
                              ? "No medicines — add new"
                              : "Select medicine"}
                          </option>
                          {medicines.map((m) => (
                            <option key={m._id} value={m._id}>
                              {m.name} (
                              {formIsPurchase ? "Rate" : "PTR"} ₹
                              {getMedicineDefaultRate(m, formInvoiceType)})
                              {!formIsPurchase
                                ? ` — Stock ${m.quantity ?? 0}`
                                : ""}
                            </option>
                          ))}
                        </select>
                        {formIsPurchase ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm medicine-add-btn"
                            onClick={() => setNewMedicineLineIndex(index)}
                          >
                            <Plus size={14} /> New
                          </button>
                        ) : null}
                      </div>
                      <FieldError
                        message={itemFieldError(index, "medicine")}
                      />
                    </div>

                    <div className="input-group input-group-hsn">
                      <label>Batch *</label>
                      {!formIsPurchase ? (
                        <select
                          value={item.batchNumber}
                          onChange={(e) =>
                            handleItemChange(index, "batchNumber", e.target.value)
                          }
                          disabled={!item.medicine}
                        >
                          <option value="">Auto (FEFO)</option>
                          {medicines
                            .find((m) => m._id === item.medicine)
                            ?.batches?.map((b) => (
                              <option key={b._id || b.batchNumber} value={b.batchNumber}>
                                {b.batchNumber} (Qty: {b.quantity}, Rate: ₹{b.rate})
                              </option>
                            ))}
                        </select>
                      ) : (
                        <input
                          value={item.batchNumber}
                          onChange={(e) =>
                            handleItemChange(index, "batchNumber", e.target.value)
                          }
                          placeholder="e.g. B-101"
                        />
                      )}
                    </div>

                    <div className="input-group input-group-hsn">
                      <label>HSN</label>
                      <input
                        value={item.hsn}
                        onChange={(e) =>
                          handleItemChange(index, "hsn", e.target.value)
                        }
                        placeholder="3004"
                        readOnly={Boolean(item.medicine)}
                      />
                    </div>

                    <div className="input-group input-group-qty">
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
                      <FieldError
                        message={itemFieldError(index, "quantity")}
                      />
                    </div>

                    <div className="input-group input-group-free">
                      <label>Free</label>
                      <input
                        type="number"
                        min="0"
                        value={item.free}
                        onChange={(e) =>
                          handleItemChange(index, "free", e.target.value)
                        }
                      />
                    </div>

                    <div className="input-group input-group-disc">
                      <label>Disc %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.discount}
                        onChange={(e) =>
                          handleItemChange(index, "discount", e.target.value)
                        }
                      />
                    </div>

                    <div className="input-group input-group-gst">
                      <label>GST</label>
                      <select
                        value={item.gstRate}
                        onChange={(e) =>
                          handleItemChange(index, "gstRate", e.target.value)
                        }
                      >
                        {GST_RATE_OPTIONS.map((rate) => (
                          <option key={rate} value={rate}>
                            {rate}%
                          </option>
                        ))}
                      </select>
                    </div>

                    {!formIsPurchase ? (
                      <div className="input-group input-group-ptr">
                        <label>PTR (₹)</label>
                        <input
                          value={item.ptr === "" ? "—" : item.ptr}
                          readOnly
                          tabIndex={-1}
                          aria-label="PTR from the selected batch"
                        />
                      </div>
                    ) : null}

                    <div className="input-group input-group-rate">
                      <label>Rate (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.rate}
                        onChange={(e) =>
                          handleItemChange(index, "rate", e.target.value)
                        }
                        className={fieldClass(
                          formErrors,
                          `items.${index}.rate`,
                        )}
                      />
                      <FieldError message={itemFieldError(index, "rate")} />
                    </div>

                    {form.items.length > 1 ? (
                      <button
                        type="button"
                        className="btn btn-ghost invoice-item-remove"
                        onClick={() => removeItem(index)}
                        aria-label="Remove item"
                      >
                        <X size={16} />
                      </button>
                    ) : (
                      <div style={{ width: 36 }} />
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="invoice-total">
              <div className="invoice-total-row">
                <span>Subtotal</span>
                <span>{formatCurrency(taxSummary.subtotal)}</span>
              </div>
              <div className="invoice-total-row">
                <span>CGST</span>
                <span>{formatCurrency(taxSummary.cgst)}</span>
              </div>
              <div className="invoice-total-row">
                <span>SGST</span>
                <span>{formatCurrency(taxSummary.sgst)}</span>
              </div>
              <div className="invoice-total-row invoice-total-grand">
                <span>Grand Total</span>
                <span>{formatCurrency(taxSummary.grandTotal)}</span>
              </div>
            </div>
          </form>
        </Modal>
      )}
      {previewInvoice && (
        <InvoicePreviewModal
          invoice={previewInvoice}
          onClose={() => setPreviewInvoice(null)}
        />
      )}
      {newMedicineLineIndex != null && (
        <AddMedicineModal
          onClose={() => setNewMedicineLineIndex(null)}
          onCreated={handleMedicineCreated}
        />
      )}
    </>
  );
}
