import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileBarChart, ExternalLink } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import LottieLoader from "../components/ui/LottieLoader";
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

function SummaryCard({ title, badge, data, accent }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
        <span className={`badge ${badge}`}>{data.invoiceCount} invoices</span>
      </div>
      <div className="card-body">
        <div className="gst-summary-grid">
          <div>
            <span className="gst-summary-label">Taxable Value</span>
            <strong style={{ color: accent }}>{formatCurrency(data.subtotal)}</strong>
          </div>
          <div>
            <span className="gst-summary-label">CGST</span>
            <strong>{formatCurrency(data.cgst)}</strong>
          </div>
          <div>
            <span className="gst-summary-label">SGST</span>
            <strong>{formatCurrency(data.sgst)}</strong>
          </div>
          <div>
            <span className="gst-summary-label">Total GST</span>
            <strong>{formatCurrency(data.gst)}</strong>
          </div>
          <div>
            <span className="gst-summary-label">Invoice Total</span>
            <strong>{formatCurrency(data.total)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function registrationBadge(type) {
  return type === "gst" ? (
    <span className="badge badge-success">GST Registered</span>
  ) : (
    <span className="badge badge-neutral">Non-GST</span>
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
    return <LottieLoader fullScreen message="Loading GST summary..." />;
  }

  if (!data) {
    return (
      <div className="empty-state" style={{ padding: "80px 24px" }}>
        Unable to load GST return data. Please try again.
      </div>
    );
  }

  const { period, summary } = data;

  return (
    <>
      <PageHeader
        title="GST Returns"
        subtitle="Quarterly sales split by GST registered and non-GST customers"
      />

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body gst-filters-body">
          <div className="gst-filters">
            <label className="input-group">
              <span>Financial Year</span>
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
            </label>

            <label className="input-group">
              <span>Quarter</span>
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
            </label>

            <div className="gst-period-label">
              <FileBarChart size={16} />
              <span>
                {period.label} · {formatCalendarDate(period.fromDate)} to{" "}
                {formatCalendarDate(period.toDate)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="gst-summary-cards">
        <SummaryCard
          title="GST Registered Customers"
          badge="badge-success"
          data={summary.gstRegistered}
          accent="var(--success)"
        />
        <SummaryCard
          title="Non-GST Customers"
          badge="badge-neutral"
          data={summary.nonGstRegistered}
          accent="var(--text-muted)"
        />
        <SummaryCard
          title="Combined Total"
          badge="badge-warning"
          data={summary.combined}
          accent="var(--primary)"
        />
      </div>

      <div className="card">
        <div className="page-tabs">
          {[
            { id: "all", label: "All" },
            { id: "gst", label: "GST Registered" },
            { id: "non-gst", label: "Non-GST" },
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
            <div className="empty-state">No sales invoices for this period.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Taxable</th>
                  <th>CGST</th>
                  <th>SGST</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice._id}>
                    <td>{invoice.invoiceNumber}</td>
                    <td>{formatCalendarDate(invoice.invoiceDate)}</td>
                    <td>
                      <div>{invoice.customerName}</div>
                      {invoice.customerGstin && (
                        <small className="text-muted">{invoice.customerGstin}</small>
                      )}
                    </td>
                    <td>{registrationBadge(invoice.registrationType)}</td>
                    <td>{formatCurrency(invoice.subtotal)}</td>
                    <td>{formatCurrency(invoice.cgst)}</td>
                    <td>{formatCurrency(invoice.sgst)}</td>
                    <td>{formatCurrency(invoice.total)}</td>
                    <td>
                      <Link
                        to="/invoices"
                        className="btn btn-ghost btn-sm"
                        title="View in Sales"
                      >
                        <ExternalLink size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
