import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  RefreshCw,
  TrendingUp,
  Users,
  Award,
  Calendar,
  FileSpreadsheet,
  AlertCircle,
  BarChart3,
  Building2,
  Phone,
  FileText,
  ChevronRight,
  Layers,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import LottieLoader from "../components/ui/LottieLoader";
import { FadeIn } from "../components/ui/fade-in";
import { dashboardApi } from "../api/client";
import { useToast } from "../context/ToastContext";

const QUARTER_HEADERS = [
  { key: "q1", label: "Q1 (Apr – Jun)" },
  { key: "q2", label: "Q2 (Jul – Sep)" },
  { key: "q3", label: "Q3 (Oct – Dec)" },
  { key: "q4", label: "Q4 (Jan – Mar)" },
];

function formatCurrency(val) {
  const num = Number(val);
  if (val == null || isNaN(num)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatNumber(val) {
  const num = Number(val);
  if (val == null || isNaN(num)) return "0";
  return new Intl.NumberFormat("en-IN").format(num);
}

function getCurrentFinancialYear() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 4 ? year : year - 1;
}

function StatCard({
  label,
  value,
  sub,
  icon,
  iconBg = "var(--surface-elevated)",
  iconColor = "var(--primary)",
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <div
          className="stat-card-icon"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
      </div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

export default function CustomerSales() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [financialYear, setFinancialYear] = useState(getCurrentFinancialYear());
  const [availableFinancialYears, setAvailableFinancialYears] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("revenue"); // "revenue" | "invoices" | "paid_pending" | "both"

  const [reportData, setReportData] = useState({
    financialYearLabel: "",
    summary: {
      grandTotalRevenue: 0,
      grandTotalPaidRevenue: 0,
      grandTotalPendingRevenue: 0,
      grandTotalInvoices: 0,
      topCustomer: "N/A",
      topCustomerAmount: 0,
      peakQuarter: "N/A",
      activeCustomersCount: 0,
    },
    quarterlyGrandTotals: Array(4)
      .fill(0)
      .map(() => ({ revenue: 0, paidRevenue: 0, pendingRevenue: 0, invoiceCount: 0 })),
    customers: [],
  });

  const fetchReport = async (fy, search = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.customerSales({ financialYear: fy, search });
      if (res && res.data) {
        setReportData({
          financialYearLabel:
            res.data.financialYearLabel || `FY ${fy}-${String(fy + 1).slice(-2)}`,
          summary: res.data.summary || {},
          quarterlyGrandTotals: res.data.quarterlyGrandTotals || [],
          customers: res.data.customers || [],
        });

        if (res.data.availableFinancialYears && res.data.availableFinancialYears.length > 0) {
          setAvailableFinancialYears(res.data.availableFinancialYears);
        } else if (res.data.availableYears && res.data.availableYears.length > 0) {
          setAvailableFinancialYears(
            res.data.availableYears.map((y) => ({
              value: y,
              label: `FY ${y}-${String(y + 1).slice(-2)}`,
            }))
          );
        }
      }
    } catch (err) {
      console.error("Failed to load quarterly customer sales report:", err);
      setError(err.message || "Failed to load customer sales report");
      toast?.error?.(err.message || "Failed to load customer sales report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(financialYear, searchTerm);
  }, [financialYear]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return reportData.customers;
    const q = searchTerm.toLowerCase();
    return reportData.customers.filter(
      (c) =>
        c.customerName.toLowerCase().includes(q) ||
        (c.contact && c.contact.toLowerCase().includes(q)) ||
        (c.gstin && c.gstin.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [reportData.customers, searchTerm]);

  const exportToCSV = () => {
    if (!reportData.customers || reportData.customers.length === 0) {
      toast?.info?.("No customer sales data available to export");
      return;
    }

    const fyLabel =
      reportData.financialYearLabel || `FY ${financialYear}-${String(financialYear + 1).slice(-2)}`;

    const headers = [
      "Customer Name",
      "Contact",
      "GSTIN",
      "City/Address",
      ...QUARTER_HEADERS.flatMap((q) => [
        `${q.label} Rev (Rs)`,
        `${q.label} Paid (Rs)`,
        `${q.label} Pending (Rs)`,
        `${q.label} Invoices`,
      ]),
      "Total Invoices",
      "Total Revenue (Rs)",
      "Total Paid (Rs)",
      "Total Pending (Rs)",
    ];

    const rows = reportData.customers.map((c) => {
      const qData = c.quarterlyData || [];
      const quarterCols = qData.flatMap((q) => [
        q.revenue || 0,
        q.paidRevenue || 0,
        q.pendingRevenue || 0,
        q.invoiceCount || 0,
      ]);
      return [
        `"${(c.customerName || "").replace(/"/g, '""')}"`,
        `"${(c.contact || "").replace(/"/g, '""')}"`,
        `"${(c.gstin || "").replace(/"/g, '""')}"`,
        `"${(c.address || "").replace(/"/g, '""')}"`,
        ...quarterCols,
        c.totalInvoices || 0,
        c.totalRevenue || 0,
        c.paidRevenue || 0,
        c.pendingRevenue || 0,
      ];
    });

    const summaryCols = (reportData.quarterlyGrandTotals || []).flatMap((q) => [
      q.revenue || 0,
      q.paidRevenue || 0,
      q.pendingRevenue || 0,
      q.invoiceCount || 0,
    ]);
    rows.push([
      '"QUARTERLY GRAND TOTAL"',
      '""',
      '""',
      '""',
      ...summaryCols,
      reportData.summary.grandTotalInvoices || 0,
      reportData.summary.grandTotalRevenue || 0,
      reportData.summary.grandTotalPaidRevenue || 0,
      reportData.summary.grandTotalPendingRevenue || 0,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Quarterly_Customer_Sales_${fyLabel.replace(/\s+/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast?.success?.(`Exported customer sales report for ${fyLabel} to CSV`);
  };

  if (loading && !reportData.customers.length) {
    return <LottieLoader fullScreen message="Loading Customer Sales analysis..." />;
  }

  const currentFYLabel =
    reportData.financialYearLabel || `FY ${financialYear}-${String(financialYear + 1).slice(-2)}`;

  return (
    <FadeIn>
      {/* Top Sales Reports Navigation Bar */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "20px",
          padding: "4px",
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          width: "fit-content",
        }}
      >
        <Link
          to="/product-sales"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "var(--radius-md)",
            fontSize: "0.875rem",
            fontWeight: 600,
            textDecoration: "none",
            color: "var(--text-muted)",
            transition: "all 0.15s ease",
          }}
        >
          <BarChart3 size={16} />
          Product-wise Sales
        </Link>
        <Link
          to="/customer-sales"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "var(--radius-md)",
            fontSize: "0.875rem",
            fontWeight: 700,
            background: "var(--primary)",
            color: "#ffffff",
            boxShadow: "0 2px 4px rgba(15, 118, 110, 0.2)",
            textDecoration: "none",
          }}
        >
          <Building2 size={16} />
          Customer-wise Sales
        </Link>
        <Link
          to="/customer-product-sales"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "var(--radius-md)",
            fontSize: "0.875rem",
            fontWeight: 600,
            textDecoration: "none",
            color: "var(--text-muted)",
            transition: "all 0.15s ease",
          }}
        >
          <Layers size={16} />
          Customer × Product Monthly
        </Link>
      </div>

      {/* Page Header */}
      <PageHeader
        title="Customer-wise Sales Analysis"
        heading="Customer-wise Sales Analysis"
        subtitle="Quarterly breakdown of sales by customer/party (Paid & Pending invoices)"
        action={
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fetchReport(financialYear, searchTerm)}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={exportToCSV}
              disabled={loading || !reportData.customers.length}
            >
              <FileSpreadsheet size={16} />
              Export CSV
            </button>
          </div>
        }
      />

      {/* 4 KPI Cards */}
      <div className="product-sales-stats-grid">
        <StatCard
          label={`TOTAL CUSTOMER REVENUE (${currentFYLabel})`}
          value={formatCurrency(reportData.summary.grandTotalRevenue)}
          sub={`Across ${reportData.summary.activeCustomersCount || 0} active client accounts`}
          icon={<TrendingUp size={20} />}
          iconBg="var(--success-bg)"
          iconColor="var(--success)"
        />

        <StatCard
          label="TOTAL INVOICES ISSUED"
          value={`${formatNumber(reportData.summary.grandTotalInvoices)} Invoices`}
          sub={`Paid: ${formatCurrency(reportData.summary.grandTotalPaidRevenue)} | Pending: ${formatCurrency(reportData.summary.grandTotalPendingRevenue)}`}
          icon={<Users size={20} />}
          iconBg="rgba(59, 130, 246, 0.15)"
          iconColor="#3b82f6"
        />

        <StatCard
          label="TOP REVENUE CLIENT"
          value={reportData.summary.topCustomer || "—"}
          sub={
            reportData.summary.topCustomerAmount > 0
              ? `Highest sales: ${formatCurrency(reportData.summary.topCustomerAmount)}`
              : "Top purchaser in selected FY"
          }
          icon={<Award size={20} />}
          iconBg="var(--warning-bg)"
          iconColor="var(--warning)"
        />

        <StatCard
          label="PEAK CLIENT SALES QUARTER"
          value={reportData.summary.peakQuarter || "—"}
          sub="Highest client billing quarter"
          icon={<Calendar size={20} />}
          iconBg="rgba(139, 92, 246, 0.15)"
          iconColor="#8b5cf6"
        />
      </div>

      {/* Main Card with Toolbar & Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Toolbar */}
        <div className="toolbar">
          <input
            type="text"
            placeholder="Search customer by name, contact, GSTIN, city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                }}
              >
                Financial Year:
              </span>
              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(Number(e.target.value))}
                style={{
                  padding: "6px 28px 6px 12px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text-main)",
                  cursor: "pointer",
                }}
              >
                {availableFinancialYears.length > 0 ? (
                  availableFinancialYears.map((fyOpt) => (
                    <option key={fyOpt.value} value={fyOpt.value}>
                      {fyOpt.label}
                    </option>
                  ))
                ) : (
                  <option value={financialYear}>
                    FY {financialYear}-{String(financialYear + 1).slice(-2)}
                  </option>
                )}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "0.825rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                Cell Display:
              </span>
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
                  onClick={() => setViewMode("revenue")}
                  style={{
                    padding: "5px 12px",
                    fontSize: "0.78rem",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    fontWeight: viewMode === "revenue" ? 700 : 500,
                    background:
                      viewMode === "revenue" ? "var(--primary)" : "transparent",
                    color: viewMode === "revenue" ? "#ffffff" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Revenue (₹)
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("invoices")}
                  style={{
                    padding: "5px 12px",
                    fontSize: "0.78rem",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    fontWeight: viewMode === "invoices" ? 700 : 500,
                    background:
                      viewMode === "invoices" ? "var(--primary)" : "transparent",
                    color: viewMode === "invoices" ? "#ffffff" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Invoices
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("paid_pending")}
                  style={{
                    padding: "5px 12px",
                    fontSize: "0.78rem",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    fontWeight: viewMode === "paid_pending" ? 700 : 500,
                    background:
                      viewMode === "paid_pending"
                        ? "var(--primary)"
                        : "transparent",
                    color:
                      viewMode === "paid_pending" ? "#ffffff" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Paid vs Pending
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("both")}
                  style={{
                    padding: "5px 12px",
                    fontSize: "0.78rem",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    fontWeight: viewMode === "both" ? 700 : 500,
                    background:
                      viewMode === "both" ? "var(--primary)" : "transparent",
                    color: viewMode === "both" ? "#ffffff" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Combined
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Matrix Content */}
        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <LottieLoader message="Generating Quarterly Customer Sales Analysis..." />
          </div>
        ) : error ? (
          <div
            style={{
              padding: "50px 20px",
              textAlign: "center",
              color: "var(--danger)",
            }}
          >
            <AlertCircle size={36} style={{ margin: "0 auto 12px" }} />
            <p style={{ margin: "0 0 16px", fontWeight: 600 }}>{error}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fetchReport(financialYear, searchTerm)}
            >
              Try Again
            </button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <Building2
              size={48}
              style={{ color: "var(--text-light)", marginBottom: "12px", opacity: 0.5 }}
            />
            <h3
              style={{
                margin: "0 0 6px",
                fontSize: "1.05rem",
                color: "var(--text-main)",
                fontWeight: 600,
              }}
            >
              No Customer Sales Found
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: "0.875rem",
                color: "var(--text-muted)",
              }}
            >
              {searchTerm
                ? `No customers match "${searchTerm}" in ${currentFYLabel}.`
                : `No customer sale invoices recorded in ${currentFYLabel}.`}
            </p>
          </div>
        ) : (
          <div className="product-matrix-wrap">
            <table className="table product-matrix-table">
              <thead>
                <tr>
                  <th style={{ minWidth: "240px", paddingLeft: "16px" }}>
                    Customer / Party Details
                  </th>
                  {QUARTER_HEADERS.map((q) => (
                    <th
                      key={q.key}
                      style={{
                        textAlign: "center",
                        minWidth:
                          viewMode === "both" || viewMode === "paid_pending"
                            ? "150px"
                            : "110px",
                      }}
                    >
                      {q.label}
                    </th>
                  ))}
                  <th style={{ textAlign: "center", width: "110px" }}>
                    Total Invoices
                  </th>
                  <th style={{ textAlign: "right", paddingRight: "16px", width: "140px" }}>
                    Total Sales (₹)
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((cust) => {
                  const qData = cust.quarterlyData || [];
                  return (
                    <tr key={cust.customerId || cust.customerName}>
                      <td style={{ paddingLeft: "16px" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "0.9rem" }}>
                          {cust.customerName}
                        </div>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "3px", fontSize: "0.76rem", color: "var(--text-muted)" }}>
                          {cust.contact && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              <Phone size={11} /> {cust.contact}
                            </span>
                          )}
                          {cust.gstin && (
                            <span className="badge badge-subtle" style={{ fontSize: "0.7rem", padding: "1px 6px" }}>
                              GST: {cust.gstin}
                            </span>
                          )}
                          {cust.address && !cust.contact && !cust.gstin && (
                            <span>{cust.address}</span>
                          )}
                        </div>
                      </td>

                      {qData.map((q, idx) => (
                        <td
                          key={idx}
                          style={{
                            textAlign: "center",
                            background: q.revenue > 0 ? "rgba(15, 118, 110, 0.03)" : "transparent",
                          }}
                        >
                          {viewMode === "revenue" && (
                            <span
                              style={{
                                fontWeight: q.revenue > 0 ? 700 : 400,
                                color: q.revenue > 0 ? "var(--text-main)" : "var(--text-light)",
                              }}
                            >
                              {formatCurrency(q.revenue)}
                            </span>
                          )}

                          {viewMode === "invoices" && (
                            <span
                              style={{
                                fontWeight: q.invoiceCount > 0 ? 700 : 400,
                                color: q.invoiceCount > 0 ? "var(--primary)" : "var(--text-light)",
                              }}
                            >
                              {q.invoiceCount ? `${q.invoiceCount} inv` : "—"}
                            </span>
                          )}

                          {viewMode === "paid_pending" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "center" }}>
                              <span style={{ fontSize: "0.78rem", color: "var(--success)", fontWeight: 600 }}>
                                Paid: {formatCurrency(q.paidRevenue)}
                              </span>
                              {q.pendingRevenue > 0 && (
                                <span style={{ fontSize: "0.74rem", color: "var(--warning)", fontWeight: 600 }}>
                                  Pend: {formatCurrency(q.pendingRevenue)}
                                </span>
                              )}
                            </div>
                          )}

                          {viewMode === "both" && (
                            <div>
                              <div style={{ fontWeight: 700, color: "var(--text-main)" }}>
                                {formatCurrency(q.revenue)}
                              </div>
                              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                                {q.invoiceCount} {q.invoiceCount === 1 ? "invoice" : "invoices"}
                              </div>
                            </div>
                          )}
                        </td>
                      ))}

                      <td style={{ textAlign: "center", fontWeight: 600 }}>
                        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
                          <span>{cust.totalInvoices}</span>
                          {cust.pendingInvoices > 0 && (
                            <span className="badge badge-warning" style={{ fontSize: "0.68rem", marginTop: "2px" }}>
                              {cust.pendingInvoices} Pending
                            </span>
                          )}
                        </div>
                      </td>

                      <td
                        style={{
                          textAlign: "right",
                          paddingRight: "16px",
                          fontWeight: 800,
                          fontSize: "0.92rem",
                          color: "var(--primary)",
                        }}
                      >
                        {formatCurrency(cust.totalRevenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr
                  style={{
                    background: "var(--surface-elevated)",
                    fontWeight: 700,
                    borderTop: "2px solid var(--border-strong)",
                  }}
                >
                  <td style={{ paddingLeft: "16px" }}>
                    QUARTERLY GRAND TOTAL
                  </td>
                  {(reportData.quarterlyGrandTotals || []).map((q, idx) => (
                    <td key={idx} style={{ textAlign: "center" }}>
                      {viewMode === "revenue" && (
                        <span>{formatCurrency(q.revenue)}</span>
                      )}
                      {viewMode === "invoices" && (
                        <span>{formatNumber(q.invoiceCount)} inv</span>
                      )}
                      {viewMode === "paid_pending" && (
                        <div style={{ fontSize: "0.78rem" }}>
                          <div style={{ color: "var(--success)" }}>P: {formatCurrency(q.paidRevenue)}</div>
                          <div style={{ color: "var(--warning)" }}>D: {formatCurrency(q.pendingRevenue)}</div>
                        </div>
                      )}
                      {viewMode === "both" && (
                        <div>
                          <div>{formatCurrency(q.revenue)}</div>
                          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                            {formatNumber(q.invoiceCount)} inv
                          </div>
                        </div>
                      )}
                    </td>
                  ))}
                  <td style={{ textAlign: "center" }}>
                    {formatNumber(reportData.summary.grandTotalInvoices)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      paddingRight: "16px",
                      fontSize: "1rem",
                      color: "var(--primary)",
                    }}
                  >
                    {formatCurrency(reportData.summary.grandTotalRevenue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </FadeIn>
  );
}
