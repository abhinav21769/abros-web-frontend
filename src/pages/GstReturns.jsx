import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileBarChart, ExternalLink, Calendar, Building2, User, Layers, Filter } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import LottieLoader from "../components/ui/LottieLoader";
import { FadeIn } from "../components/ui/fade-in";
import { gstApi } from "../api/client";
import { useToast } from "../context/ToastContext";
import { formatCalendarDate, getInvoiceMonthNumber } from "../utils/dateUtils";

const QUARTER_OPTIONS = [
  { value: 1, label: "Q1 (Apr – Jun)" },
  { value: 2, label: "Q2 (Jul – Sep)" },
  { value: 3, label: "Q3 (Oct – Dec)" },
  { value: 4, label: "Q4 (Jan – Mar)" },
];

const ALL_MONTHS_OPTIONS = [
  { value: 4, label: "April (Q1)" },
  { value: 5, label: "May (Q1)" },
  { value: 6, label: "June (Q1)" },
  { value: 7, label: "July (Q2)" },
  { value: 8, label: "August (Q2)" },
  { value: 9, label: "September (Q2)" },
  { value: 10, label: "October (Q3)" },
  { value: 11, label: "November (Q3)" },
  { value: 12, label: "December (Q3)" },
  { value: 1, label: "January (Q4)" },
  { value: 2, label: "February (Q4)" },
  { value: 3, label: "March (Q4)" },
];

const QUARTER_MONTH_MAP = {
  1: [
    { value: "all", label: "All Months in Q1" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
  ],
  2: [
    { value: "all", label: "All Months in Q2" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
  ],
  3: [
    { value: "all", label: "All Months in Q3" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ],
  4: [
    { value: "all", label: "All Months in Q4" },
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
  ],
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function getCurrentFinancialYear() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 4 ? year : year - 1;
}

function getCurrentQuarter() {
  const month = new Date().getMonth() + 1;
  if (month >= 4 && month <= 6) return 1;
  if (month >= 7 && month <= 9) return 2;
  if (month >= 10 && month <= 12) return 3;
  return 4;
}

function buildFinancialYearOptions() {
  const current = getCurrentFinancialYear();
  return Array.from({ length: 6 }, (_, index) => {
    const year = current - index;
    return {
      value: year,
      label: `FY ${year}-${String(year + 1).slice(-2)}`,
    };
  });
}

function SummaryCard({ title, badge, data, accent, icon: Icon }) {
  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--surface-elevated)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: accent,
            }}
          >
            <Icon size={16} />
          </div>
          <h3>{title}</h3>
        </div>
        <span className={`badge ${badge}`}>{data.invoiceCount} invoices</span>
      </div>
      <div className="card-body">
        <div className="gst-summary-grid">
          <div className="gst-summary-item">
            <span className="gst-summary-label">Taxable Value</span>
            <span className="gst-summary-value">{formatCurrency(data.subtotal)}</span>
          </div>
          <div className="gst-summary-item">
            <span className="gst-summary-label">Total GST Tax</span>
            <span className="gst-summary-value" style={{ color: accent }}>
              {formatCurrency(data.gst)}
            </span>
          </div>
          <div className="gst-summary-item">
            <span className="gst-summary-label">CGST (50%)</span>
            <span className="gst-summary-value">{formatCurrency(data.cgst)}</span>
          </div>
          <div className="gst-summary-item">
            <span className="gst-summary-label">SGST (50%)</span>
            <span className="gst-summary-value">{formatCurrency(data.sgst)}</span>
          </div>
          <div className="gst-summary-item full-width">
            <span className="gst-summary-label">Grand Total Amount</span>
            <span className="gst-summary-value highlight">{formatCurrency(data.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function registrationBadge(type) {
  return type === "gst" ? (
    <span className="badge badge-success">B2B Registered</span>
  ) : (
    <span className="badge badge-neutral">B2C Retail</span>
  );
}

export default function GstReturns() {
  const toast = useToast();
  const financialYearOptions = useMemo(() => buildFinancialYearOptions(), []);

  const [financialYear, setFinancialYear] = useState(getCurrentFinancialYear());
  const [periodType, setPeriodType] = useState("quarterly"); // "quarterly" | "monthly" | "yearly"
  const [quarter, setQuarter] = useState(getCurrentQuarter());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [filter, setFilter] = useState("all");
  const [tableMonthSubFilter, setTableMonthSubFilter] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      let params = { financialYear, periodType };
      if (periodType === "quarterly") {
        params.quarter = quarter;
      } else if (periodType === "monthly") {
        params.month = selectedMonth;
      } else if (periodType === "yearly") {
        params.quarter = "all";
      }

      const res = await gstApi.quarterlySummary(params);
      setData(res.data);
    } catch (err) {
      toast.error(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [financialYear, periodType, quarter, selectedMonth, toast]);

  useEffect(() => {
    loadSummary();
    setTableMonthSubFilter("all");
  }, [loadSummary]);

  // Current quarter month options for sub-filter in quarterly mode
  const quarterMonthOptions = useMemo(() => {
    return QUARTER_MONTH_MAP[quarter] || QUARTER_MONTH_MAP[1];
  }, [quarter]);

  // Filter invoices by month sub-filter if active
  const monthFilteredInvoices = useMemo(() => {
    if (!data?.invoices) return [];
    if (periodType === "quarterly" && tableMonthSubFilter !== "all") {
      return data.invoices.filter((inv) => {
        const m = getInvoiceMonthNumber(inv.invoiceDate);
        return String(m) === String(tableMonthSubFilter);
      });
    }
    return data.invoices;
  }, [data, periodType, tableMonthSubFilter]);

  // Counts for sub-tabs
  const counts = useMemo(() => {
    const total = monthFilteredInvoices.length;
    const b2b = monthFilteredInvoices.filter((i) => i.registrationType === "gst").length;
    const b2c = monthFilteredInvoices.filter((i) => i.registrationType === "non-gst").length;
    return { total, b2b, b2c };
  }, [monthFilteredInvoices]);

  // Final invoices shown in table after registration type filter
  const finalInvoices = useMemo(() => {
    if (filter === "all") return monthFilteredInvoices;
    return monthFilteredInvoices.filter((inv) => inv.registrationType === filter);
  }, [monthFilteredInvoices, filter]);

  // Total summary for table footer
  const tableTotals = useMemo(() => {
    return finalInvoices.reduce(
      (acc, inv) => {
        acc.subtotal += Number(inv.subtotal) || 0;
        acc.cgst += Number(inv.cgst) || 0;
        acc.sgst += Number(inv.sgst) || 0;
        acc.total += Number(inv.total) || 0;
        return acc;
      },
      { subtotal: 0, cgst: 0, sgst: 0, total: 0 },
    );
  }, [finalInvoices]);

  if (loading) {
    return <LottieLoader fullScreen message="Calculating GST tax returns..." />;
  }

  if (!data) {
    return (
      <div className="card" style={{ margin: "40px auto", maxWidth: 500, textAlign: "center" }}>
        <div className="card-body" style={{ padding: "40px 24px" }}>
          <FileBarChart size={32} color="var(--warning)" style={{ marginBottom: 12 }} />
          <h3 style={{ fontSize: "1.1rem", marginBottom: 6 }}>GST Return Data Unavailable</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Unable to fetch GST tax summary for the selected period.
          </p>
        </div>
      </div>
    );
  }

  const { period, summary } = data;

  return (
    <>
      <PageHeader
        title="GST Tax Returns & Reports"
        subtitle="GSTR-1 sales tax filing report split by B2B registered and B2C retail invoices with monthly & quarterly views"
      />

      <FadeIn className="card gst-filters-card" delay={0.05}>
        <div className="card-body gst-filters-body">
          <div className="gst-filters" style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            {/* Financial Year */}
            <div className="gst-filter-item">
              <label>Financial Year</label>
              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(Number(e.target.value))}
              >
                {financialYearOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Period Type: Quarterly vs Monthly vs Full Year */}
            <div className="gst-filter-item">
              <label>Period Type</label>
              <div
                style={{
                  display: "inline-flex",
                  background: "var(--surface)",
                  padding: "3px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  gap: "4px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setPeriodType("quarterly")}
                  style={{
                    padding: "5px 12px",
                    fontSize: "0.78rem",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    fontWeight: periodType === "quarterly" ? 700 : 500,
                    background:
                      periodType === "quarterly" ? "var(--primary)" : "transparent",
                    color:
                      periodType === "quarterly" ? "#ffffff" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Quarterly
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodType("monthly")}
                  style={{
                    padding: "5px 12px",
                    fontSize: "0.78rem",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    fontWeight: periodType === "monthly" ? 700 : 500,
                    background:
                      periodType === "monthly" ? "var(--primary)" : "transparent",
                    color:
                      periodType === "monthly" ? "#ffffff" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodType("yearly")}
                  style={{
                    padding: "5px 12px",
                    fontSize: "0.78rem",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    fontWeight: periodType === "yearly" ? 700 : 500,
                    background:
                      periodType === "yearly" ? "var(--primary)" : "transparent",
                    color:
                      periodType === "yearly" ? "#ffffff" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Full Year
                </button>
              </div>
            </div>

            {/* Specific Quarter or Month Selector */}
            {periodType === "quarterly" && (
              <div className="gst-filter-item">
                <label>Filing Quarter</label>
                <select
                  value={quarter}
                  onChange={(e) => setQuarter(Number(e.target.value))}
                >
                  {QUARTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodType === "monthly" && (
              <div className="gst-filter-item">
                <label>Filing Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {ALL_MONTHS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="gst-period-label" style={{ marginLeft: "auto" }}>
              <Calendar size={16} />
              <span>
                {period.label}: {formatCalendarDate(period.fromDate)} – {formatCalendarDate(period.toDate)}
              </span>
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn className="gst-summary-cards" delay={0.1}>
        <SummaryCard
          title="B2B (GST Registered)"
          badge="badge-success"
          data={summary.gstRegistered}
          accent="var(--success)"
          icon={Building2}
        />
        <SummaryCard
          title="B2C Retail Sales"
          badge="badge-neutral"
          data={summary.nonGstRegistered}
          accent="var(--accent)"
          icon={User}
        />
        <SummaryCard
          title="Combined Returns Total"
          badge="badge-warning"
          data={summary.combined}
          accent="var(--primary)"
          icon={Layers}
        />
      </FadeIn>

      <FadeIn className="card" delay={0.15}>
        {/* Table Controls: Sub-Tabs + Quarter & Month Selectors */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px 12px",
            borderBottom: "1px solid var(--border-subtle)",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div className="page-tabs" style={{ margin: 0, padding: 0 }}>
            {[
              { id: "all", label: `All Invoices (${counts.total})` },
              { id: "gst", label: `B2B Registered (${counts.b2b})` },
              { id: "non-gst", label: `B2C Retail (${counts.b2c})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`page-tab${filter === tab.id ? " active" : ""}`}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            {/* If in Quarterly mode, allow filtering by month within quarter */}
            {periodType === "quarterly" && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Filter size={14} style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)" }}>
                  Filter Month:
                </span>
                <select
                  value={tableMonthSubFilter}
                  onChange={(e) => setTableMonthSubFilter(e.target.value)}
                  style={{
                    padding: "5px 24px 5px 10px",
                    fontSize: "0.825rem",
                    fontWeight: 600,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                  }}
                >
                  {quarterMonthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="table-wrap">
          {finalInvoices.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px 20px", textAlign: "center" }}>
              No GST sales invoices found for the selected month/filter.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Customer / Recipient</th>
                  <th>Tax Type</th>
                  <th>Taxable Amount</th>
                  <th>CGST</th>
                  <th>SGST</th>
                  <th>Total Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {finalInvoices.map((invoice) => (
                  <tr key={invoice._id}>
                    <td>
                      <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                        {invoice.invoiceNumber}
                      </span>
                    </td>
                    <td>{formatCalendarDate(invoice.invoiceDate)}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{invoice.customerName}</div>
                      {invoice.customerGstin && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                          GSTIN: {invoice.customerGstin}
                        </div>
                      )}
                    </td>
                    <td>{registrationBadge(invoice.registrationType)}</td>
                    <td style={{ fontWeight: 500 }}>{formatCurrency(invoice.subtotal)}</td>
                    <td>{formatCurrency(invoice.cgst)}</td>
                    <td>{formatCurrency(invoice.sgst)}</td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(invoice.total)}</td>
                    <td>
                      <Link
                        to="/invoices"
                        className="btn btn-ghost btn-sm"
                        title="View invoice details"
                      >
                        <ExternalLink size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr
                  style={{
                    fontWeight: 700,
                    background: "var(--surface-elevated)",
                    borderTop: "2px solid var(--border)",
                  }}
                >
                  <td colSpan={4} style={{ textAlign: "right", color: "var(--text-main)", paddingRight: 16 }}>
                    Total ({finalInvoices.length} {finalInvoices.length === 1 ? "invoice" : "invoices"}):
                  </td>
                  <td style={{ fontWeight: 700, color: "var(--text-main)" }}>
                    {formatCurrency(tableTotals.subtotal)}
                  </td>
                  <td style={{ fontWeight: 700, color: "var(--text-main)" }}>
                    {formatCurrency(tableTotals.cgst)}
                  </td>
                  <td style={{ fontWeight: 700, color: "var(--text-main)" }}>
                    {formatCurrency(tableTotals.sgst)}
                  </td>
                  <td style={{ fontWeight: 800, color: "var(--primary)", fontSize: "0.95rem" }}>
                    {formatCurrency(tableTotals.total)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </FadeIn>
    </>
  );
}
