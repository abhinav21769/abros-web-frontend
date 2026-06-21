import { useCallback, useEffect, useMemo, useState } from "react";
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

const emptyItem = {
  medicine: "",
  medicineName: "",
  hsn: "",
  gstRate: "5",
  quantity: "1",
  free: "0",
  rate: "",
};

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
  items: [{ ...emptyItem }],
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

function statusBadge(status) {
  const map = {
    paid: "badge-success",
    pending: "badge-warning",
    cancelled: "badge-danger",
  };
  return (
    <span className={`badge ${map[status] || "badge-neutral"}`}>{status}</span>
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

export default function Invoices() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = resolveInvoiceType(searchParams.get("type"));
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [page, setPage] = useState(1);
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
    const params = { page, limit: 10, invoiceType };
    if (search) params.invoiceNumber = search;

    invoicesApi
      .list(params)
      .then((res) => {
        setItems(res.data.items);
        setPagination(res.data.pagination);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [page, search, invoiceType, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const loadFormData = async (type = invoiceType) => {
    const [custRes, medRes, numRes] = await Promise.all([
      customersApi.list({ limit: 100 }),
      medicinesApi.list({ limit: 500, expired: "false" }),
      invoicesApi.generateNumber(type),
    ]);
    setCustomers(custRes.data.items);
    setMedicines(medRes.data.items);
    return {
      invoiceNumber: numRes.data.invoiceNumber,
      medicines: medRes.data.items,
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
      setForm({ ...emptyForm, invoiceNumber, items: [{ ...emptyItem }] });
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
          medicine: i.medicine?._id || i.medicine || "",
          medicineName: i.medicineName,
          hsn: i.hsn || i.medicine?.hsn || "",
          gstRate: String(i.gstRate ?? i.medicine?.gstRate ?? 5),
          quantity: String(i.quantity),
          free: String(i.free ?? 0),
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
    setForm((prev) => ({ ...prev, [name]: value }));
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
          items[index].medicineName = med.name;
          items[index].rate = String(getMedicineDefaultRate(med, type));
          items[index].hsn = med.hsn || "";
          items[index].gstRate = String(med.gstRate ?? 5);
        } else {
          items[index].medicineName = "";
          items[index].rate = "";
          items[index].hsn = "";
          items[index].gstRate = "5";
        }
      }

      return { ...prev, items };
    });
    setFormErrors((prev) => clearFieldError(prev, `items.${index}.${field}`));
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

  const taxSummary = useMemo(
    () =>
      calculateInvoiceTax(
        form.items.map((item) => ({
          quantity: Number(item.quantity) || 0,
          rate: Number(item.rate) || 0,
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
        hsn: item.hsn || undefined,
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
      toast.error(err.message);
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
            placeholder="Search by invoice number..."
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
                      <td>{statusBadge(item.status)}</td>
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
                  <select
                    name="customer"
                    value={form.customer}
                    onChange={handleChange}
                    className={fieldClass(formErrors, "customer")}
                  >
                    <option value="">Select customer</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
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
              <strong>Line Items</strong>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={addItem}
                disabled={!formIsPurchase && medicines.length === 0}
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div className="invoice-items">
              {!formIsPurchase && medicines.length === 0 ? (
                <div className="empty-state">
                  No active medicines in inventory. Add medicines first.
                </div>
              ) : (
                form.items.map((item, index) => (
                  <div key={index} className="invoice-item-card">
                    <div className="invoice-item-row invoice-item-row-top">
                      <div className="input-group">
                        <label>Medicine *</label>
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
                                ? "No medicines yet — add new"
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
                        {!formIsPurchase &&
                        item.medicine &&
                        form.status !== "cancelled" ? (
                          <p
                            className={`invoice-stock-hint${
                              getAvailableStockForLine({
                                formItems: form.items,
                                medicines,
                                lineIndex: index,
                                editingInvoice: editing,
                                formStatus: form.status,
                              }) === 0
                                ? " invoice-stock-hint--empty"
                                : ""
                            }`}
                          >
                            Available:{" "}
                            {getAvailableStockForLine({
                              formItems: form.items,
                              medicines,
                              lineIndex: index,
                              editingInvoice: editing,
                              formStatus: form.status,
                            })}
                          </p>
                        ) : null}
                        <FieldError
                          message={itemFieldError(index, "medicine")}
                        />
                      </div>
                      <div className="input-group">
                        <label>HSN</label>
                        <input
                          value={item.hsn}
                          onChange={(e) =>
                            handleItemChange(index, "hsn", e.target.value)
                          }
                          placeholder="3004"
                          readOnly={Boolean(item.medicine)}
                          className={fieldClass(
                            formErrors,
                            `items.${index}.hsn`,
                          )}
                        />
                        <FieldError message={itemFieldError(index, "hsn")} />
                      </div>
                    </div>
                    <div className="invoice-item-row invoice-item-row-bottom">
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
                        <FieldError
                          message={itemFieldError(index, "quantity")}
                        />
                      </div>
                      <div className="input-group">
                        <label>Free</label>
                        <input
                          type="number"
                          min="0"
                          value={item.free}
                          onChange={(e) =>
                            handleItemChange(index, "free", e.target.value)
                          }
                          className={fieldClass(
                            formErrors,
                            `items.${index}.free`,
                          )}
                        />
                        <FieldError message={itemFieldError(index, "free")} />
                      </div>
                      <div className="input-group">
                        <label>GST %</label>
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
                      <div className="input-group">
                        <label>
                          {formIsPurchase ? "Rate (₹) *" : "Rate / PTR (₹) *"}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
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
