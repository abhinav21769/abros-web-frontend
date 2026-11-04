// Pure helpers behind the GST Returns page: Indian financial-year periods,
// invoice filtering, totals and the CSV export. Kept free of React so they can be
// unit-tested; the page only wires them to state.

import { getInvoiceMonthNumber } from "./dateUtils";

export const PERIOD_TYPES = [
  { value: "quarterly", label: "Quarterly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Full Year" },
];

export const QUARTERS = [
  { value: 1, label: "Q1", range: "Apr – Jun" },
  { value: 2, label: "Q2", range: "Jul – Sep" },
  { value: 3, label: "Q3", range: "Oct – Dec" },
  { value: 4, label: "Q4", range: "Jan – Mar" },
];

// Financial-year order (April first), with the quarter each month falls in.
export const MONTHS = [
  { value: 4, short: "Apr", name: "April", quarter: 1 },
  { value: 5, short: "May", name: "May", quarter: 1 },
  { value: 6, short: "Jun", name: "June", quarter: 1 },
  { value: 7, short: "Jul", name: "July", quarter: 2 },
  { value: 8, short: "Aug", name: "August", quarter: 2 },
  { value: 9, short: "Sep", name: "September", quarter: 2 },
  { value: 10, short: "Oct", name: "October", quarter: 3 },
  { value: 11, short: "Nov", name: "November", quarter: 3 },
  { value: 12, short: "Dec", name: "December", quarter: 3 },
  { value: 1, short: "Jan", name: "January", quarter: 4 },
  { value: 2, short: "Feb", name: "February", quarter: 4 },
  { value: 3, short: "Mar", name: "March", quarter: 4 },
];

export const REGISTRATION_FILTERS = [
  { id: "all", label: "All" },
  { id: "gst", label: "B2B Registered" },
  { id: "non-gst", label: "B2C Retail" },
];

export function monthsInQuarter(quarter) {
  return MONTHS.filter((month) => month.quarter === quarter);
}

export function getFinancialYear(date = new Date()) {
  const month = date.getMonth() + 1;
  return month >= 4 ? date.getFullYear() : date.getFullYear() - 1;
}

export function getQuarter(date = new Date()) {
  const month = date.getMonth() + 1;
  return MONTHS.find((entry) => entry.value === month).quarter;
}

export function buildFinancialYearOptions(date = new Date(), count = 6) {
  const current = getFinancialYear(date);
  return Array.from({ length: count }, (_, index) => {
    const year = current - index;
    return { value: year, label: `FY ${year}-${String(year + 1).slice(-2)}` };
  });
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function formatCurrencyExact(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

// Query params for gstApi.quarterlySummary, per period type.
export function buildSummaryParams({ financialYear, periodType, quarter, month }) {
  const params = { financialYear, periodType };
  if (periodType === "quarterly") params.quarter = quarter;
  else if (periodType === "monthly") params.month = month;
  else params.quarter = "all";
  return params;
}

export function filterInvoices(invoices, { registration = "all", month = "all", search = "" } = {}) {
  const term = search.trim().toLowerCase();

  return (invoices || []).filter((invoice) => {
    if (registration !== "all" && invoice.registrationType !== registration) return false;
    if (month !== "all" && getInvoiceMonthNumber(invoice.invoiceDate) !== Number(month)) return false;
    if (!term) return true;

    return [invoice.invoiceNumber, invoice.customerName, invoice.customerGstin].some((field) =>
      String(field || "").toLowerCase().includes(term),
    );
  });
}

export function sumInvoices(invoices) {
  return (invoices || []).reduce(
    (acc, invoice) => {
      acc.count += 1;
      acc.subtotal += Number(invoice.subtotal) || 0;
      acc.cgst += Number(invoice.cgst) || 0;
      acc.sgst += Number(invoice.sgst) || 0;
      acc.gst += Number(invoice.gst) || 0;
      acc.total += Number(invoice.total) || 0;
      return acc;
    },
    { count: 0, subtotal: 0, cgst: 0, sgst: 0, gst: 0, total: 0 },
  );
}

// Share of `part` in `whole` as a 0-100 number; 0 when there is nothing to split.
export function percentOf(part, whole) {
  const denominator = Number(whole) || 0;
  if (denominator <= 0) return 0;
  return Math.round(((Number(part) || 0) / denominator) * 1000) / 10;
}

export function buildGstCsv(invoices, formatDate) {
  const headers = [
    "Invoice #",
    "Date",
    "Customer",
    "GSTIN",
    "Type",
    "Status",
    "Taxable Value",
    "CGST",
    "SGST",
    "Total GST",
    "Invoice Total",
  ];

  const rows = invoices.map((invoice) => [
    invoice.invoiceNumber,
    formatDate(invoice.invoiceDate),
    invoice.customerName,
    invoice.customerGstin || "",
    invoice.registrationType === "gst" ? "B2B" : "B2C",
    invoice.status || "",
    Number(invoice.subtotal) || 0,
    Number(invoice.cgst) || 0,
    Number(invoice.sgst) || 0,
    Number(invoice.gst) || 0,
    Number(invoice.total) || 0,
  ]);

  return { headers, rows };
}

export function gstCsvFilename(period) {
  const slug = String(period?.label || "gst-report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `gstr1-${slug}.csv`;
}
