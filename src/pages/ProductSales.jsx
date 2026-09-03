import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
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
  { key: "q1", label: "Q1 (Apr – Jun)", shortLabel: "Q1", index: 0 },
  { key: "q2", label: "Q2 (Jul – Sep)", shortLabel: "Q2", index: 1 },
  { key: "q3", label: "Q3 (Oct – Dec)", shortLabel: "Q3", index: 2 },
  { key: "q4", label: "Q4 (Jan – Mar)", shortLabel: "Q4", index: 3 },
];

const MONTH_HEADERS = [
  { key: "m4", label: "Apr", fullLabel: "April", index: 0, monthNumber: 4 },
  { key: "m5", label: "May", fullLabel: "May", index: 1, monthNumber: 5 },
  { key: "m6", label: "Jun", fullLabel: "June", index: 2, monthNumber: 6 },
  { key: "m7", label: "Jul", fullLabel: "July", index: 3, monthNumber: 7 },
  { key: "m8", label: "Aug", fullLabel: "August", index: 4, monthNumber: 8 },
  { key: "m9", label: "Sep", fullLabel: "September", index: 5, monthNumber: 9 },
  { key: "m10", label: "Oct", fullLabel: "October", index: 6, monthNumber: 10 },
  { key: "m11", label: "Nov", fullLabel: "November", index: 7, monthNumber: 11 },
  { key: "m12", label: "Dec", fullLabel: "December", index: 8, monthNumber: 12 },
  { key: "m1", label: "Jan", fullLabel: "January", index: 9, monthNumber: 1 },
  { key: "m2", label: "Feb", fullLabel: "February", index: 10, monthNumber: 2 },
  { key: "m3", label: "Mar", fullLabel: "March", index: 11, monthNumber: 3 },
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
  const [breakdownType, setBreakdownType] = useState("quarterly"); // "quarterly" | "monthly"
  const [selectedPeriod, setSelectedPeriod] = useState("all"); // "all" | "q1".."q4" | "4".."3"
  const [viewMode, setViewMode] = useState("quantity"); // "quantity" | "revenue" | "both"
  const [expandedProducts, setExpandedProducts] = useState(new Set());

  const toggleProduct = (key) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
    monthlyGrandTotals: Array(12)
      .fill(0)
      .map(() => ({ quantity: 0, revenue: 0 })),
    products: [],
  });

  const fetchReport = async (fy, search = "", isStale = () => false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.productSales({ financialYear: fy, search });
      // Guards against a slower, superseded request (e.g. rapidly switching
      // the FY dropdown) resolving after a newer one and clobbering it.
      if (isStale()) return;
      if (res && res.data) {
        setReportData({
          financialYearLabel:
            res.data.financialYearLabel || `FY ${fy}-${String(fy + 1).slice(-2)}`,
          summary: res.data.summary || {},
          quarterlyGrandTotals: res.data.quarterlyGrandTotals || [],
          monthlyGrandTotals: res.data.monthlyGrandTotals || [],
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
      if (isStale()) return;
      logger.error("Failed to load product sales report", err);
      setError(err.message || "Failed to load sales report");
      toast?.error?.(err.message || "Failed to load sales report");
    } finally {
      if (!isStale()) setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchReport sets loading state up front by design (spinner shows immediately); the cancelled flag below is what actually matters, guarding against a stale response landing after a newer one.
    fetchReport(financialYear, searchTerm, () => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- search is intentionally client-side only (see filteredProducts); refetching per keystroke here would be unnecessary and unpaced by a debounce.
  }, [financialYear]);

  const handleBreakdownChange = (type) => {
    setBreakdownType(type);
    setSelectedPeriod("all");
  };

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

  const activeColumns = useMemo(() => {
    if (breakdownType === "monthly") {
      if (selectedPeriod !== "all") {
        const found = MONTH_HEADERS.find(
          (m) => String(m.monthNumber) === String(selectedPeriod) || m.key === selectedPeriod
        );
        return found ? [found] : MONTH_HEADERS;
      }
      return MONTH_HEADERS;
    } else {
      if (selectedPeriod !== "all") {
        const found = QUARTER_HEADERS.find(
          (q) => q.key === selectedPeriod || String(q.index + 1) === String(selectedPeriod)
        );
        return found ? [found] : QUARTER_HEADERS;
      }
      return QUARTER_HEADERS;
    }
  }, [breakdownType, selectedPeriod]);

  const getCellData = useCallback(
    (prod, col) => {
      if (breakdownType === "monthly") {
        const mList = prod.monthlyData || [];
        const mItem = mList[col.index] || { quantity: 0, free: 0, revenue: 0 };
        const totalUnits = (mItem.quantity || 0) + (mItem.free || 0);
        return { totalUnits, revenue: mItem.revenue || 0 };
      } else {
        const qList = prod.quarterlyData || [];
        const qItem = qList[col.index] || { quantity: 0, free: 0, revenue: 0 };
        const totalUnits = (qItem.quantity || 0) + (qItem.free || 0);
        return { totalUnits, revenue: qItem.revenue || 0 };
      }
    },
    [breakdownType],
  );

  // Always the full financial year, independent of the Period filter - a
  // "Total" that just repeats the one visible column when filtered to a
  // single quarter/month isn't a useful total, so this gives a stable
  // year-to-date figure to compare each filtered period against.
  const getRowTotals = useCallback((prod) => {
    const source = prod.quarterlyData || [];
    let rowUnits = 0;
    let rowRev = 0;
    source.forEach((q) => {
      rowUnits += (q.quantity || 0) + (q.free || 0);
      rowRev += q.revenue || 0;
    });
    return {
      quantity: rowUnits,
      revenue: Math.round(rowRev * 100) / 100,
    };
  }, []);

  const footerTotals = useMemo(() => {
    const colTotals = activeColumns.map((col) => {
      let colQty = 0;
      let colRev = 0;
      filteredProducts.forEach((prod) => {
        const cell = getCellData(prod, col);
        colQty += cell.totalUnits;
        colRev += cell.revenue;
      });
      return {
        quantity: colQty,
        revenue: Math.round(colRev * 100) / 100,
      };
    });

    let grandQty = 0;
    let grandRev = 0;
    filteredProducts.forEach((prod) => {
      const r = getRowTotals(prod);
      grandQty += r.quantity;
      grandRev += r.revenue;
    });

    return {
      colTotals,
      grandTotalQuantity: grandQty,
      grandTotalRevenue: Math.round(grandRev * 100) / 100,
    };
  }, [filteredProducts, activeColumns, getCellData, getRowTotals]);

  const exportToCSV = () => {
    if (!filteredProducts || filteredProducts.length === 0) {
      toast?.info?.("No sales data available to export");
      return;
    }

    const fyLabel =
      reportData.financialYearLabel || `FY ${financialYear}-${String(financialYear + 1).slice(-2)}`;

    const headers = [
      "Product Name",
      ...activeColumns.flatMap((col) => [
        `${col.label || col.fullLabel} Qty`,
        `${col.label || col.fullLabel} Revenue (Rs)`,
      ]),
      "Total Qty Sold",
      "Total Revenue (Rs)",
    ];

    const rows = filteredProducts.map((p) => {
      const colData = activeColumns.flatMap((col) => {
        const cell = getCellData(p, col);
        return [cell.totalUnits, cell.revenue];
      });
      const rowTot = getRowTotals(p);
      return [
        p.medicineName || "",
        ...colData,
        rowTot.quantity,
        rowTot.revenue,
      ];
    });

    const summaryCols = footerTotals.colTotals.flatMap((col) => [
      col.quantity,
      col.revenue,
    ]);
    rows.push([
      "GRAND TOTAL",
      ...summaryCols,
      footerTotals.grandTotalQuantity,
      footerTotals.grandTotalRevenue,
    ]);

    const prefix = breakdownType === "monthly" ? "Monthly" : "Quarterly";
    downloadCsv(
      `${prefix}_Product_Sales_${fyLabel.replace(/\s+/g, "_")}.csv`,
      headers,
      rows
    );

    toast?.success?.(`Exported ${prefix.toLowerCase()} sales report for ${fyLabel} to CSV`);
  };

  if (loading && !reportData.products.length) {
    return <LottieLoader fullScreen message="Loading Product Sales analysis..." />;
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
            background: "transparent",
            color: "var(--text-muted)",
            textDecoration: "none",
            transition: "all 0.15s ease",
          }}
        >
          <Building2 size={16} />
          Customer × Product Monthly
        </Link>
      </div>

      {/* Page Header */}
      <PageHeader
        title={`Product-wise Sales Matrix — ${currentFYLabel}`}
        subtitle="Comprehensive product sales volume and revenue across months and quarters with totals"
        action={
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fetchReport(financialYear, searchTerm)}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={exportToCSV}
              disabled={!filteredProducts || filteredProducts.length === 0}
            >
              <FileSpreadsheet size={16} />
              Export CSV
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div
        className="stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <StatCard
          label="Total Products"
          value={formatNumber(reportData.summary.totalProductsCount || reportData.products.length)}
          sub="With recorded sales"
          icon={<Package size={20} />}
          iconBg="rgba(14, 165, 233, 0.12)"
          iconColor="#0284c7"
        />
        <StatCard
          label="Total Units Sold"
          value={formatNumber(
            (reportData.summary.grandTotalQuantity || 0) +
              (reportData.summary.grandTotalFree || 0)
          )}
          sub={`${formatNumber(reportData.summary.grandTotalFree || 0)} free sample units`}
          icon={<TrendingUp size={20} />}
          iconBg="rgba(16, 185, 129, 0.12)"
          iconColor="#10b981"
        />
        <StatCard
          label="Annual Sales Revenue"
          value={formatCurrency(reportData.summary.grandTotalRevenue)}
          sub={`For ${currentFYLabel}`}
          icon={<Award size={20} />}
          iconBg="rgba(245, 158, 11, 0.12)"
          iconColor="#d97706"
        />
        <StatCard
          label="Top Selling Product"
          value={reportData.summary.topProduct || "N/A"}
          sub="By annual revenue"
          icon={<Award size={20} />}
          iconBg="rgba(99, 102, 241, 0.12)"
          iconColor="#6366f1"
        />
        <StatCard
          label="Peak Quarter"
          value={reportData.summary.peakQuarter || "N/A"}
          sub="Highest revenue period"
          icon={<Calendar size={20} />}
          iconBg="rgba(236, 72, 153, 0.12)"
          iconColor="#db2777"
        />
      </div>

      {/* Main Card with search & controls */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          className="toolbar"
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          {/* Search Box */}
          <div className="search-box" style={{ maxWidth: 300, flex: 1, minWidth: 220 }}>
            <input
              type="text"
              placeholder="Search product or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Controls: Breakdown Toggle, Period Filter, FY Selector, Cell Display */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            {/* Breakdown Toggle: Quarterly vs Monthly */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "0.825rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                View:
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
                  onClick={() => handleBreakdownChange("quarterly")}
                  style={{
                    padding: "5px 12px",
                    fontSize: "0.78rem",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    fontWeight: breakdownType === "quarterly" ? 700 : 500,
                    background:
                      breakdownType === "quarterly" ? "var(--primary)" : "transparent",
                    color:
                      breakdownType === "quarterly" ? "#ffffff" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Quarterly
                </button>
                <button
                  type="button"
                  onClick={() => handleBreakdownChange("monthly")}
                  style={{
                    padding: "5px 12px",
                    fontSize: "0.78rem",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    fontWeight: breakdownType === "monthly" ? 700 : 500,
                    background:
                      breakdownType === "monthly" ? "var(--primary)" : "transparent",
                    color:
                      breakdownType === "monthly" ? "#ffffff" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Monthly
                </button>
              </div>
            </div>

            {/* Period Filter Dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "0.825rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                Period:
              </span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
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
                {breakdownType === "quarterly" ? (
                  <>
                    <option value="all">All Quarters (Full FY)</option>
                    {QUARTER_HEADERS.map((q) => (
                      <option key={q.key} value={q.key}>
                        {q.label}
                      </option>
                    ))}
                  </>
                ) : (
                  <>
                    <option value="all">All 12 Months</option>
                    {MONTH_HEADERS.map((m) => (
                      <option key={m.key} value={String(m.monthNumber)}>
                        {m.fullLabel}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Financial Year Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "0.825rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                FY:
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

            {/* Cell Display Mode */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "0.825rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                Cells:
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
                    padding: "5px 10px",
                    fontSize: "0.78rem",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    fontWeight: viewMode === "quantity" ? 700 : 500,
                    background:
                      viewMode === "quantity" ? "var(--primary)" : "transparent",
                    color:
                      viewMode === "quantity" ? "#ffffff" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Qty
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("revenue")}
                  style={{
                    padding: "5px 10px",
                    fontSize: "0.78rem",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    fontWeight: viewMode === "revenue" ? 700 : 500,
                    background:
                      viewMode === "revenue" ? "var(--primary)" : "transparent",
                    color:
                      viewMode === "revenue" ? "#ffffff" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Rev
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("both")}
                  style={{
                    padding: "5px 10px",
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
            <LottieLoader message="Generating Product Sales Report..." />
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
                  {activeColumns.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        textAlign: "right",
                        minWidth: activeColumns.length > 4 ? "90px" : "120px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col.label || col.fullLabel}
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
                  const rowTotals = getRowTotals(prod);
                  const rowKey = prod.id || prod.medicineName;
                  const hasBatchBreakdown = prod.batchBreakdown && prod.batchBreakdown.length > 1;
                  const isExpanded = hasBatchBreakdown && expandedProducts.has(rowKey);
                  return (
                    <Fragment key={rowKey}>
                    <tr>
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
                          {hasBatchBreakdown && (
                            <button
                              type="button"
                              onClick={() => toggleProduct(rowKey)}
                              title={
                                (isExpanded ? "Hide" : "Show") +
                                " which batch labels this product's sales were recorded against - this reflects what each invoice line said at the time of sale, not the batches currently in stock (see Inventory for that)."
                              }
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "999px",
                                border: "1px solid var(--border)",
                                background: isExpanded ? "var(--primary)" : "var(--surface-elevated)",
                                color: isExpanded ? "#ffffff" : "var(--text-muted)",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <Layers size={11} />
                              {prod.batchBreakdown.length} sold
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Active Column Cells */}
                      {activeColumns.map((col) => {
                        const cell = getCellData(prod, col);
                        const hasSales = cell.totalUnits > 0 || cell.revenue > 0;
                        return (
                          <td
                            key={col.key}
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
                                {hasSales ? formatNumber(cell.totalUnits) : "—"}
                              </span>
                            )}

                            {viewMode === "revenue" && (
                              <span>
                                {hasSales ? formatCurrency(cell.revenue) : "—"}
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
                                  {hasSales ? formatCurrency(cell.revenue) : "—"}
                                </span>
                                {hasSales && (
                                  <span
                                    style={{
                                      fontSize: "0.72rem",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    {formatNumber(cell.totalUnits)} pcs
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Total Qty */}
                      <td className="total-qty-col" style={{ textAlign: "right", fontWeight: 600 }}>
                        {formatNumber(rowTotals.quantity)} Pcs
                      </td>

                      {/* Total Revenue */}
                      <td className="total-rev-col" style={{ textAlign: "right" }}>
                        {formatCurrency(rowTotals.revenue)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: "var(--surface-elevated)" }}>
                        <td colSpan={activeColumns.length + 3} style={{ padding: "12px 16px 16px 46px" }}>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)" }}>
                              Sales by batch label — {currentFYLabel}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>
                              Reflects what each sale recorded at the time - may not match the batches currently in
                              stock (see Inventory).
                            </div>
                          </div>
                          <table style={{ width: "100%", maxWidth: 560, fontSize: "0.8rem" }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--text-muted)" }}>
                                  Batch No.
                                </th>
                                <th style={{ textAlign: "right", padding: "6px 10px", color: "var(--text-muted)" }}>
                                  Qty Sold
                                </th>
                                <th style={{ textAlign: "right", padding: "6px 10px", color: "var(--text-muted)" }}>
                                  Free
                                </th>
                                <th style={{ textAlign: "right", padding: "6px 10px", color: "var(--text-muted)" }}>
                                  Revenue
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {prod.batchBreakdown.map((b) => (
                                <tr key={b.batchNumber}>
                                  <td style={{ padding: "6px 10px", fontFamily: "monospace", fontWeight: 600 }}>
                                    {b.batchNumber}
                                  </td>
                                  <td style={{ padding: "6px 10px", textAlign: "right" }}>
                                    {formatNumber(b.totalQuantity)}
                                  </td>
                                  <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--text-muted)" }}>
                                    {b.totalFree > 0 ? formatNumber(b.totalFree) : "—"}
                                  </td>
                                  <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>
                                    {formatCurrency(b.totalRevenue)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                    </Fragment>
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
                    GRAND TOTAL ({filteredProducts.length} {filteredProducts.length === 1 ? "Product" : "Products"})
                  </td>

                  {/* Column Totals */}
                  {footerTotals.colTotals.map((cTot, cIdx) => (
                    <td
                      key={activeColumns[cIdx]?.key || cIdx}
                      style={{ textAlign: "right", fontWeight: 700 }}
                    >
                      {viewMode === "quantity" && formatNumber(cTot.quantity)}
                      {viewMode === "revenue" && formatCurrency(cTot.revenue)}
                      {viewMode === "both" && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{formatCurrency(cTot.revenue)}</span>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {formatNumber(cTot.quantity)} pcs
                          </span>
                        </div>
                      )}
                    </td>
                  ))}

                  {/* Grand Total Qty */}
                  <td
                    className="total-qty-col"
                    style={{ textAlign: "right", fontWeight: 800 }}
                  >
                    {formatNumber(footerTotals.grandTotalQuantity)} Pcs
                  </td>

                  {/* Grand Total Revenue */}
                  <td
                    className="total-rev-col"
                    style={{ textAlign: "right", fontWeight: 800 }}
                  >
                    {formatCurrency(footerTotals.grandTotalRevenue)}
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
