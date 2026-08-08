import { useState, useEffect, useMemo } from "react";
import {
  RefreshCw,
  TrendingUp,
  Package,
  Award,
  Calendar,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import LottieLoader from "../components/ui/LottieLoader";
import { FadeIn } from "../components/ui/fade-in";
import { dashboardApi } from "../api/client";
import { useToast } from "../context/ToastContext";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("revenue"); // "revenue" | "quantity" | "both"

  const [reportData, setReportData] = useState({
    summary: {
      grandTotalRevenue: 0,
      grandTotalQuantity: 0,
      topProduct: "N/A",
      peakMonth: "N/A",
      totalProductsCount: 0,
    },
    monthlyGrandTotals: Array(12)
      .fill(0)
      .map(() => ({ quantity: 0, revenue: 0 })),
    products: [],
  });

  const fetchReport = async (year, search = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.productSales({ year, search });
      if (res && res.data) {
        setReportData({
          summary: res.data.summary || {},
          monthlyGrandTotals: res.data.monthlyGrandTotals || [],
          products: res.data.products || [],
        });

        if (res.data.availableYears && res.data.availableYears.length > 0) {
          setAvailableYears(res.data.availableYears);
        }
      }
    } catch (err) {
      console.error("Failed to load product sales report:", err);
      setError(err.message || "Failed to load sales report");
      toast?.error?.(err.message || "Failed to load sales report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(selectedYear, searchTerm);
  }, [selectedYear]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return reportData.products;
    const q = searchTerm.toLowerCase();
    return reportData.products.filter((p) =>
      p.medicineName.toLowerCase().includes(q)
    );
  }, [reportData.products, searchTerm]);

  const exportToCSV = () => {
    if (!reportData.products || reportData.products.length === 0) {
      toast?.info?.("No sales data available to export");
      return;
    }

    const headers = [
      "Product Name",
      ...MONTH_NAMES.flatMap((m) => [`${m} Qty`, `${m} Revenue (Rs)`]),
      "Total Qty Sold",
      "Total Revenue (Rs)",
    ];

    const rows = reportData.products.map((p) => {
      const monthCols = p.monthlyData.flatMap((m) => [
        m.quantity || 0,
        m.revenue || 0,
      ]);
      return [
        `"${(p.medicineName || "").replace(/"/g, '""')}"`,
        ...monthCols,
        p.totalQuantity || 0,
        p.totalRevenue || 0,
      ];
    });

    const summaryCols = reportData.monthlyGrandTotals.flatMap((m) => [
      m.quantity || 0,
      m.revenue || 0,
    ]);
    rows.push([
      '"MONTHLY GRAND TOTAL"',
      ...summaryCols,
      reportData.summary.grandTotalQuantity || 0,
      reportData.summary.grandTotalRevenue || 0,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Month_Wise_Product_Sales_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast?.success?.(`Exported sales report for ${selectedYear} to CSV`);
  };

  if (loading && !reportData.products.length) {
    return <LottieLoader fullScreen message="Loading Product Sales analysis..." />;
  }

  return (
    <FadeIn>
      {/* Page Header */}
        <PageHeader
          title="Month-Wise Product Sales"
          heading="Month-Wise Product Sales"
          action={
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fetchReport(selectedYear, searchTerm)}
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

        {/* 4 KPI Cards in a clean single-row grid */}
        <div className="product-sales-stats-grid">
          <StatCard
            label={`TOTAL REVENUE (${selectedYear})`}
            value={formatCurrency(reportData.summary.grandTotalRevenue)}
            sub={`Across ${reportData.summary.totalProductsCount || 0} active products`}
            icon={<TrendingUp size={20} />}
            iconBg="var(--success-bg)"
            iconColor="var(--success)"
          />

          <StatCard
            label="TOTAL UNITS SOLD"
            value={`${formatNumber(reportData.summary.grandTotalQuantity)} Pcs`}
            sub="Total quantity fulfilled"
            icon={<Package size={20} />}
            iconBg="rgba(59, 130, 246, 0.15)"
            iconColor="#3b82f6"
          />

          <StatCard
            label="TOP PERFORMING PRODUCT"
            value={reportData.summary.topProduct || "—"}
            sub="Highest revenue contributor"
            icon={<Award size={20} />}
            iconBg="var(--warning-bg)"
            iconColor="var(--warning)"
          />

          <StatCard
            label="PEAK SALES MONTH"
            value={reportData.summary.peakMonth || "—"}
            sub="Best monthly revenue period"
            icon={<Calendar size={20} />}
            iconBg="rgba(139, 92, 246, 0.15)"
            iconColor="#8b5cf6"
          />
        </div>

        {/* Main Card with standard .toolbar search & matrix table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Standard Toolbar across modules */}
          <div className="toolbar">
            <input
              type="text"
              placeholder="Search product by name..."
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
                  Year:
                </span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
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
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
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
                        viewMode === "revenue"
                          ? "var(--primary)"
                          : "transparent",
                      color:
                        viewMode === "revenue"
                          ? "#ffffff"
                          : "var(--text-muted)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Revenue (₹)
                  </button>

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
              <LottieLoader message="Generating Month-Wise Product Sales Report..." />
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
                onClick={() => fetchReport(selectedYear, searchTerm)}
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
                  ? `No products matching "${searchTerm}" found for ${selectedYear}.`
                  : `No sales recorded in the year ${selectedYear}.`}
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
                    {MONTH_NAMES.map((m) => (
                      <th
                        key={m}
                        style={{ textAlign: "right", minWidth: "90px" }}
                      >
                        {m}
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
                  {filteredProducts.map((prod, idx) => (
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

                      {/* 12 Months Data Cells */}
                      {prod.monthlyData.map((m, mIdx) => {
                        const hasSales = m.quantity > 0 || m.revenue > 0;
                        return (
                          <td
                            key={mIdx}
                            style={{
                              textAlign: "right",
                              color: hasSales
                                ? "var(--text-main)"
                                : "var(--text-muted)",
                              fontWeight: hasSales ? 500 : 400,
                              opacity: hasSales ? 1 : 0.6,
                            }}
                          >
                            {viewMode === "revenue" && (
                              <span>
                                {hasSales ? formatCurrency(m.revenue) : "—"}
                              </span>
                            )}

                            {viewMode === "quantity" && (
                              <span>
                                {hasSales
                                  ? `${formatNumber(m.quantity)}`
                                  : "—"}
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
                                  {hasSales ? formatCurrency(m.revenue) : "—"}
                                </span>
                                {hasSales && (
                                  <span
                                    style={{
                                      fontSize: "0.72rem",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    {m.quantity} pcs
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Total Qty */}
                      <td className="total-qty-col" style={{ textAlign: "right" }}>
                        {formatNumber(prod.totalQuantity)} Pcs
                      </td>

                      {/* Total Revenue */}
                      <td className="total-rev-col" style={{ textAlign: "right" }}>
                        {formatCurrency(prod.totalRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Grand Total Footer Row */}
                <tfoot>
                  <tr>
                    <td
                      className="sticky-col"
                      style={{ textAlign: "left", fontWeight: 800 }}
                    >
                      MONTHLY TOTAL
                    </td>
                    {reportData.monthlyGrandTotals.map((m, mIdx) => (
                      <td
                        key={mIdx}
                        style={{ textAlign: "right", fontWeight: 700 }}
                      >
                        {viewMode === "revenue" && formatCurrency(m.revenue)}
                        {viewMode === "quantity" && formatNumber(m.quantity)}
                        {viewMode === "both" && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                            }}
                          >
                            <span>{formatCurrency(m.revenue)}</span>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              {formatNumber(m.quantity)} pcs
                            </span>
                          </div>
                        )}
                      </td>
                    ))}
                    <td
                      className="total-qty-col"
                      style={{ textAlign: "right", fontWeight: 800 }}
                    >
                      {formatNumber(reportData.summary.grandTotalQuantity)} Pcs
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
