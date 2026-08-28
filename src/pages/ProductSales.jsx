import { useState, useEffect, useMemo } from "react";
import logger from "../utils/logger";
import { downloadCsv } from "../utils/csvExport";
import { Link } from "react-router-dom";
import {
  RefreshCw,
  TrendingUp,
  Package,
  Award,
  Calendar,
  FileSpreadsheet,
  AlertCircle,
  BarChart3,
  Building2,
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

export default function ProductSales() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [financialYear, setFinancialYear] = useState(getCurrentFinancialYear());
  const [availableFinancialYears, setAvailableFinancialYears] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("quantity"); // "quantity" | "revenue" | "both"

  const [reportData, setReportData] = useState({
    financialYearLabel: "",
    summary: {
      grandTotalRevenue: 0,
      grandTotalQuantity: 0,
      topProduct: "N/A",
      peakQuarter: "N/A",
      totalProductsCount: 0,
    },
    quarterlyGrandTotals: Array(4)
      .fill(0)
      .map(() => ({ quantity: 0, revenue: 0 })),
    products: [],
  });

  const fetchReport = async (fy, search = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.productSales({ financialYear: fy, search });
      if (res && res.data) {
        const qTotals =
          res.data.quarterlyGrandTotals || res.data.monthlyGrandTotals || [];
        setReportData({
          financialYearLabel:
            res.data.financialYearLabel || `FY ${fy}-${String(fy + 1).slice(-2)}`,
          summary: res.data.summary || {},
          quarterlyGrandTotals: qTotals,
          products: res.data.products || [],
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
      logger.error("Failed to load quarterly product sales report", err);
      setError(err.message || "Failed to load sales report");
      toast?.error?.(err.message || "Failed to load sales report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(financialYear, searchTerm);
  }, [financialYear]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return reportData.products;
    const q = searchTerm.toLowerCase();
    return reportData.products.filter(
      (p) =>
        p.medicineName.toLowerCase().includes(q) ||
        (p.customerNames &&
          Array.isArray(p.customerNames) &&
          p.customerNames.some((c) => c && c.toLowerCase().includes(q)))
    );
  }, [reportData.products, searchTerm]);

  const exportToCSV = () => {
    if (!reportData.products || reportData.products.length === 0) {
      toast?.info?.("No sales data available to export");
      return;
    }

    const fyLabel =
      reportData.financialYearLabel || `FY ${financialYear}-${String(financialYear + 1).slice(-2)}`;

    const headers = [
      "Product Name",
      ...QUARTER_HEADERS.flatMap((q) => [
        `${q.label} Qty`,
        `${q.label} Revenue (Rs)`,
      ]),
      "Total Qty Sold",
      "Total Revenue (Rs)",
    ];

    const rows = reportData.products.map((p) => {
      const qData = p.quarterlyData || p.monthlyData || [];
      const quarterCols = qData.flatMap((q) => [
        (q.quantity || 0) + (q.free || 0),
        q.revenue || 0,
      ]);
      return [
        p.medicineName || "",
        ...quarterCols,
        (p.totalQuantity || 0) + (p.totalFree || 0),
        p.totalRevenue || 0,
      ];
    });

    const summaryCols = (reportData.quarterlyGrandTotals || []).flatMap((q) => [
      (q.quantity || 0) + (q.free || 0),
      q.revenue || 0,
    ]);
    rows.push([
      "QUARTERLY GRAND TOTAL",
      ...summaryCols,
      (reportData.summary.grandTotalQuantity || 0) + (reportData.summary.grandTotalFree || 0),
      reportData.summary.grandTotalRevenue || 0,
    ]);

    downloadCsv(
      `Quarterly_Product_Sales_${fyLabel.replace(/\s+/g, "_")}.csv`,
      headers,
      rows
    );

    toast?.success?.(`Exported quarterly sales report for ${fyLabel} to CSV`);
  };

  if (loading && !reportData.products.length) {
    return <LottieLoader fullScreen message="Loading Quarterly Product Sales analysis..." />;
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
            fontWeight: 700,
            background: "var(--primary)",
            color: "#ffffff",
            boxShadow: "0 2px 4px rgba(15, 118, 110, 0.2)",
            textDecoration: "none",
          }}
        >
          <BarChart3 size={16} />
          Product-wise Sales
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
        title="Quarterly Product Sales"
        heading="Quarterly Product Sales"
        subtitle="Quarterly breakdown of product sales (Paid & Pending invoices)"
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
              disabled={loading || !reportData.products.length}
            >
              <FileSpreadsheet size={16} />
              Export CSV
            </button>
          </div>
        }
      />


      {/* Main Card with standard .toolbar search & matrix table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="toolbar" style={{ borderBottom: "1px solid var(--border-subtle)", padding: "16px 20px" }}>
          <div className="search-box" style={{ maxWidth: 320 }}>
            <input
              type="text"
              placeholder="Search by product or customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

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
                  fontSize: "0.825rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                Financial Year:
              </span>
              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(Number(e.target.value))}
                style={{
                  padding: "6px 28px 6px 12px",
                  fontSize: "0.825rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text-main)",
                  fontWeight: 600,
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
                  onClick={() => setViewMode("quantity")}
                  style={{
                    padding: "5px 12px",
                    fontSize: "0.78rem",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    fontWeight: viewMode === "quantity" ? 700 : 500,
                    background:
                      viewMode === "quantity"
                        ? "var(--primary)"
                        : "transparent",
                    color:
                      viewMode === "quantity"
                        ? "#ffffff"
                        : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Quantity (Pcs)
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
                    color:
                      viewMode === "both" ? "#ffffff" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Both
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Matrix Content */}
        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <LottieLoader message="Generating Quarterly Product Sales Report..." />
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
        ) : filteredProducts.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            <Package size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <h3
              style={{
                fontSize: "1.1rem",
                fontWeight: 600,
                margin: "0 0 6px",
                color: "var(--text-main)",
              }}
            >
              No Sales Data Found
            </h3>
            <p style={{ fontSize: "0.85rem", margin: 0 }}>
              {searchTerm
                ? `No products matching "${searchTerm}" found for ${currentFYLabel}.`
                : `No sales recorded in ${currentFYLabel}.`}
            </p>
          </div>
        ) : (
          <div className="product-matrix-wrap">
            <table className="product-matrix-table">
              <thead>
                <tr>
                  <th
                    className="sticky-col"
                    style={{ minWidth: "220px", textAlign: "left" }}
                  >
                    PRODUCT NAME
                  </th>
                  {QUARTER_HEADERS.map((q) => (
                    <th
                      key={q.key}
                      style={{ textAlign: "right", minWidth: "120px" }}
                    >
                      {q.label}
                    </th>
                  ))}
                  <th
                    className="total-qty-col"
                    style={{ textAlign: "right", minWidth: "110px" }}
                  >
                    TOTAL QTY
                  </th>
                  <th
                    className="total-rev-col"
                    style={{ textAlign: "right", minWidth: "130px" }}
                  >
                    TOTAL REVENUE
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((prod, idx) => {
                  const qList = prod.quarterlyData || prod.monthlyData || [];
                  return (
                    <tr key={prod.medicineName}>
                      {/* Product Name Sticky Column */}
                      <td className="sticky-col" style={{ fontWeight: 600 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                              minWidth: "18px",
                            }}
                          >
                            {idx + 1}.
                          </span>
                          <span>{prod.medicineName}</span>
                        </div>
                      </td>

                      {/* 4 Quarter Data Cells */}
                      {qList.map((q, qIdx) => {
                        const totalUnits = (q.quantity || 0) + (q.free || 0);
                        const hasSales = totalUnits > 0 || q.revenue > 0;
                        return (
                          <td
                            key={qIdx}
                            style={{
                              textAlign: "right",
                              color: hasSales
                                ? "var(--text-main)"
                                : "var(--text-muted)",
                              fontWeight: hasSales ? 500 : 400,
                              opacity: hasSales ? 1 : 0.6,
                            }}
                          >
                            {viewMode === "quantity" && (
                              <span>
                                {hasSales ? formatNumber(totalUnits) : "—"}
                              </span>
                            )}

                            {viewMode === "revenue" && (
                              <span>
                                {hasSales ? formatCurrency(q.revenue) : "—"}
                              </span>
                            )}

                            {viewMode === "both" && (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "2px",
                                }}
                              >
                                <span style={{ fontWeight: 600 }}>
                                  {hasSales ? formatCurrency(q.revenue) : "—"}
                                </span>
                                {hasSales && (
                                  <span
                                    style={{
                                      fontSize: "0.72rem",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    {formatNumber(totalUnits)} pcs
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Total Qty */}
                      <td className="total-qty-col" style={{ textAlign: "right", fontWeight: 600 }}>
                        {formatNumber((prod.totalQuantity || 0) + (prod.totalFree || 0))} Pcs
                      </td>

                      {/* Total Revenue */}
                      <td className="total-rev-col" style={{ textAlign: "right" }}>
                        {formatCurrency(prod.totalRevenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Grand Total Footer Row */}
              <tfoot>
                <tr>
                  <td
                    className="sticky-col"
                    style={{ textAlign: "left", fontWeight: 800 }}
                  >
                    QUARTERLY TOTAL
                  </td>
                  {(reportData.quarterlyGrandTotals || []).map((q, qIdx) => {
                    const qTotalUnits = (q.quantity || 0) + (q.free || 0);
                    return (
                      <td
                        key={qIdx}
                        style={{ textAlign: "right", fontWeight: 700 }}
                      >
                        {viewMode === "quantity" && formatNumber(qTotalUnits)}
                        {viewMode === "revenue" && formatCurrency(q.revenue)}
                        {viewMode === "both" && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                            }}
                          >
                            <span>{formatCurrency(q.revenue)}</span>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              {formatNumber(qTotalUnits)} pcs
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td
                    className="total-qty-col"
                    style={{ textAlign: "right", fontWeight: 800 }}
                  >
                    {formatNumber(
                      (reportData.summary.grandTotalQuantity || 0) +
                        (reportData.summary.grandTotalFree || 0) ||
                        (reportData.quarterlyGrandTotals || []).reduce(
                          (acc, q) => acc + (q.quantity || 0) + (q.free || 0),
                          0
                        )
                    )}{" "}
                    Pcs
                  </td>
                  <td
                    className="total-rev-col"
                    style={{ textAlign: "right", fontWeight: 800 }}
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
