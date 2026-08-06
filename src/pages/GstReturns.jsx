import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileBarChart, ExternalLink, Calendar, Building2, User, Layers } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import LottieLoader from "../components/ui/LottieLoader";
import { FadeIn } from "../components/ui/fade-in";
import { gstApi } from "../api/client";
import { useToast } from "../context/ToastContext";
import { formatCalendarDate } from "../utils/dateUtils";

const QUARTER_OPTIONS = [
  { value: 1, label: "Q1 (Apr – Jun)" },
  { value: 2, label: "Q2 (Jul – Sep)" },
  { value: 3, label: "Q3 (Oct – Dec)" },
  { value: 4, label: "Q4 (Jan – Mar)" },
];

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
  const [quarter, setQuarter] = useState(getCurrentQuarter());
  const [filter, setFilter] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await gstApi.quarterlySummary({ financialYear, quarter });
      setData(res.data);
    } catch (err) {
      toast.error(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [financialYear, quarter, toast]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const filteredInvoices = useMemo(() => {
    if (!data?.invoices) return [];
    if (filter === "all") return data.invoices;
    return data.invoices.filter((inv) => inv.registrationType === filter);
  }, [data, filter]);

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
        subtitle="Quarterly GSTR-1 sales tax filing report split by B2B registered and B2C retail invoices"
      />

      <FadeIn className="card gst-filters-card" delay={0.05}>
        <div className="card-body gst-filters-body">
          <div className="gst-filters">
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

            <div className="gst-period-label">
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
        <div className="page-tabs">
          {[
            { id: "all", label: `All Invoices (${data.invoices.length})` },
            { id: "gst", label: `B2B Registered (${summary.gstRegistered.invoiceCount})` },
            { id: "non-gst", label: `B2C Retail (${summary.nonGstRegistered.invoiceCount})` },
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

        <div className="table-wrap">
          {filteredInvoices.length === 0 ? (
            <div className="empty-state">No sales invoices recorded for this filing quarter.</div>
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
                {filteredInvoices.map((invoice) => (
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
            </table>
          )}
        </div>
      </FadeIn>
    </>
  );
}
