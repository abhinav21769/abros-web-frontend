import { useState, useEffect, useMemo, Fragment } from "react";
import { Link } from "react-router-dom";
import {
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  BarChart3,
  Building2,
  ChevronRight,
  ChevronDown,
  Layers,
  Search,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import LottieLoader from "../components/ui/LottieLoader";
import { FadeIn } from "../components/ui/fade-in";
import { dashboardApi } from "../api/client";
import { useToast } from "../context/ToastContext";

const MONTH_HEADERS = [
  "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"
];

function formatCurrency(val) {
  const num = Number(val);
  if (val == null || isNaN(num) || num === 0) return "₹0";
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

export default function CustomerProductSales() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [financialYear, setFinancialYear] = useState(getCurrentFinancialYear());
  const [availableFinancialYears, setAvailableFinancialYears] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCustomers, setExpandedCustomers] = useState({});

  const [reportData, setReportData] = useState({
    financialYearLabel: "",
    summary: {
      grandTotalRevenue: 0,
      grandTotalQuantity: 0,
      activeCustomersCount: 0,
    },
    monthlyGrandTotals: Array(12).fill(0).map((_, i) => ({ monthName: MONTH_HEADERS[i], quantity: 0, revenue: 0 })),
    customers: [],
  });

  const fetchReport = async (fy, search = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.customerProductSales({
        financialYear: fy,
        search,
      });
      if (res && res.data) {
        const custs = res.data.customers || [];
        setReportData({
          financialYearLabel:
            res.data.financialYearLabel || `FY ${fy}-${String(fy + 1).slice(-2)}`,
          summary: res.data.summary || {},
          monthlyGrandTotals: res.data.monthlyGrandTotals || [],
          customers: custs,
        });

        // Expand all customers by default
        const initExpanded = {};
        custs.forEach((c) => {
          const k = c.customerId || c.customerName;
          initExpanded[k] = true;
        });
        setExpandedCustomers(initExpanded);

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
      console.error("Failed to load customer x product monthly sales report:", err);
      setError(err.message || "Failed to load report");
      toast?.error?.(err.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(financialYear, searchTerm);
  }, [financialYear]);

  const toggleCustomerExpand = (key) => {
    setExpandedCustomers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return reportData.customers;

    const q = searchTerm.toLowerCase();
    return reportData.customers
      .map((c) => {
        const matchesCust =
          c.customerName.toLowerCase().includes(q) ||
          (c.contact && c.contact.toLowerCase().includes(q)) ||
          (c.gstin && c.gstin.toLowerCase().includes(q));

        if (matchesCust) return c;

        const matchingProds = (c.products || []).filter((p) =>
          p.medicineName.toLowerCase().includes(q)
        );

        if (matchingProds.length > 0) {
          return {
            ...c,
            products: matchingProds,
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [reportData.customers, searchTerm]);

  const exportToCSV = () => {
    if (!filteredCustomers || filteredCustomers.length === 0) {
      toast?.info?.("No sales data available to export");
      return;
    }

    const fyLabel =
      reportData.financialYearLabel || `FY ${financialYear}-${String(financialYear + 1).slice(-2)}`;

    const periodHeaders = MONTH_HEADERS.flatMap((m) => [`${m} Qty`, `${m} Rev (Rs)`]);

    const headers = [
      "Customer Name",
      "Product Name",
      "Contact",
      "GSTIN",
      ...periodHeaders,
      "Total Qty",
      "Total Revenue (Rs)",
    ];

    const rows = [];

    filteredCustomers.forEach((c) => {
      (c.products || []).forEach((p) => {
        const dataArr = p.monthlyData || [];
        const cols = dataArr.flatMap((d) => [d.quantity || 0, d.revenue || 0]);
        rows.push([
          `"${(c.customerName || "").replace(/"/g, '""')}"`,
          `"${(p.medicineName || "").replace(/"/g, '""')}"`,
          `"${(c.contact || "").replace(/"/g, '""')}"`,
          `"${(c.gstin || "").replace(/"/g, '""')}"`,
          ...cols,
          p.totalQuantity || 0,
          p.totalRevenue || 0,
        ]);
      });
    });

    const summaryCols = (reportData.monthlyGrandTotals || []).flatMap((d) => [
      d.quantity || 0,
      d.revenue || 0,
    ]);

    rows.push([
      '"GRAND TOTAL"',
      '""',
      '""',
      '""',
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
    link.setAttribute(
      "download",
      `Customer_Product_Monthly_Sales_${fyLabel.replace(/\s+/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast?.success?.(`Exported sales report to CSV`);
  };

  const currentFYLabel =
    reportData.financialYearLabel || `FY ${financialYear}-${String(financialYear + 1).slice(-2)}`;

  return (
    <FadeIn>
      {/* Navigation Sub-Tabs */}
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
          }}
        >
          <BarChart3 size={16} />
          Product Sales
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
            fontWeight: 700,
            background: "var(--primary)",
            color: "#ffffff",
            boxShadow: "0 2px 4px rgba(15, 118, 110, 0.2)",
            textDecoration: "none",
          }}
        >
          <Layers size={16} />
          Customer × Product Monthly
        </Link>
      </div>

      {/* Page Header */}
      <PageHeader
        title="Customer × Product Monthly Sales"
        heading="Customer × Product Monthly Sales"
        subtitle={`Monthly product sales breakdown by customer (${currentFYLabel})`}
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

      {/* Main Container */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Simple Clean Toolbar */}
        <div className="toolbar">
          <div style={{ position: "relative", width: "320px" }}>
            <input
              type="text"
              placeholder="Search customer or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: "100%", paddingLeft: "34px" }}
            />
            <Search
              size={15}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-light)",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Financial Year Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>
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
          </div>
        </div>

        {/* Single Unified Table showing Quantity & Revenue together */}
        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <LottieLoader message="Loading Monthly Customer-Product Sales..." />
          </div>
        ) : error ? (
          <div style={{ padding: "50px 20px", textAlign: "center", color: "var(--danger)" }}>
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
            <Layers size={44} style={{ color: "var(--text-light)", marginBottom: "12px", opacity: 0.5 }} />
            <h3 style={{ margin: "0 0 6px", fontSize: "1rem", color: "var(--text-main)", fontWeight: 600 }}>
              No Sales Found
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
              No sales records match your search criteria for {currentFYLabel}.
            </p>
          </div>
        ) : (
          <div className="product-matrix-wrap">
            <table className="table product-matrix-table" style={{ width: "100%", tableLayout: "auto" }}>
              <thead>
                <tr>
                  <th style={{ minWidth: "260px", paddingLeft: "16px", textAlign: "left" }}>
                    CUSTOMER / PRODUCT
                  </th>
                  {MONTH_HEADERS.map((m) => (
                    <th key={m} style={{ textAlign: "center", minWidth: "90px" }}>
                      {m.toUpperCase()}
                    </th>
                  ))}
                  <th style={{ textAlign: "right", paddingRight: "16px", minWidth: "150px" }}>
                    TOTAL (QTY & REVENUE)
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((cust) => {
                  const custKey = cust.customerId || cust.customerName;
                  const isExpanded = expandedCustomers[custKey] !== false;

                  return (
                    <Fragment key={custKey}>
                      {/* Customer Row */}
                      <tr
                        onClick={() => toggleCustomerExpand(custKey)}
                        style={{
                          background: "var(--surface-elevated)",
                          cursor: "pointer",
                          userSelect: "none",
                          borderTop: "2px solid var(--border)",
                        }}
                      >
                        <td style={{ paddingLeft: "16px", textAlign: "left" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ color: "var(--primary)", display: "flex", alignItems: "center" }}>
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </div>
                            <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--text-main)" }}>
                              {cust.customerName}
                            </span>
                            <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 500 }}>
                              ({cust.products.length} {cust.products.length === 1 ? "product" : "products"})
                            </span>
                          </div>
                        </td>

                        {/* Customer Monthly Totals (Qty & Revenue) */}
                        {(cust.monthlyTotals || Array(12).fill({ quantity: 0, revenue: 0 })).map((cell, idx) => {
                          const hasData = cell.quantity > 0 || cell.revenue > 0;
                          return (
                            <td
                              key={idx}
                              style={{
                                textAlign: "center",
                                fontSize: "0.82rem",
                                background: hasData ? "rgba(15, 118, 110, 0.03)" : "transparent",
                              }}
                            >
                              {hasData ? (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
                                  <span style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "0.82rem" }}>
                                    {cell.quantity > 0 ? `${formatNumber(cell.quantity)} Pcs` : "0"}
                                  </span>
                                  <span style={{ fontSize: "0.72rem", color: "var(--primary)", fontWeight: 600 }}>
                                    {formatCurrency(cell.revenue)}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: "var(--text-light)" }}>—</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Customer Grand Total (Qty & Revenue) */}
                        <td style={{ textAlign: "right", paddingRight: "16px" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px" }}>
                            <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--text-main)" }}>
                              {formatNumber(cust.totalQuantity)} Pcs
                            </span>
                            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--primary)" }}>
                              {formatCurrency(cust.totalRevenue)}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Product Rows under Customer */}
                      {isExpanded &&
                        cust.products.map((prod) => (
                          <tr
                            key={prod.medicineName}
                            style={{
                              background: "var(--surface)",
                              borderBottom: "1px solid var(--border-subtle)",
                            }}
                          >
                            <td
                              style={{
                                paddingLeft: "38px",
                                textAlign: "left",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                                color: "var(--text-main)",
                              }}
                            >
                              {prod.medicineName}
                            </td>

                            {(prod.monthlyData || []).map((cell, idx) => {
                              const hasData = cell.quantity > 0 || cell.revenue > 0;
                              return (
                                <td
                                  key={idx}
                                  style={{
                                    textAlign: "center",
                                    fontSize: "0.82rem",
                                    background: hasData ? "rgba(15, 118, 110, 0.02)" : "transparent",
                                  }}
                                >
                                  {hasData ? (
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
                                      <span style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "0.82rem" }}>
                                        {cell.quantity > 0 ? `${cell.quantity}` : "0"}
                                      </span>
                                      <span style={{ fontSize: "0.71rem", color: "var(--primary)", fontWeight: 500 }}>
                                        {formatCurrency(cell.revenue)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span style={{ color: "var(--text-light)" }}>—</span>
                                  )}
                                </td>
                              );
                            })}

                            <td style={{ textAlign: "right", paddingRight: "16px" }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px" }}>
                                <span style={{ fontWeight: 700, fontSize: "0.86rem", color: "var(--text-main)" }}>
                                  {formatNumber(prod.totalQuantity)} Pcs
                                </span>
                                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary)" }}>
                                  {formatCurrency(prod.totalRevenue)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr
                  style={{
                    background: "var(--surface-elevated)",
                    fontWeight: 800,
                    borderTop: "3px solid var(--border-strong)",
                  }}
                >
                  <td style={{ paddingLeft: "16px", textAlign: "left" }}>GRAND TOTAL</td>
                  {(reportData.monthlyGrandTotals || []).map((cell, idx) => (
                    <td key={idx} style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
                        <span style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "0.82rem" }}>
                          {formatNumber(cell.quantity)} Pcs
                        </span>
                        <span style={{ fontSize: "0.74rem", color: "var(--primary)", fontWeight: 700 }}>
                          {formatCurrency(cell.revenue)}
                        </span>
                      </div>
                    </td>
                  ))}
                  <td style={{ textAlign: "right", paddingRight: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px" }}>
                      <span style={{ fontWeight: 800, fontSize: "0.92rem", color: "var(--text-main)" }}>
                        {formatNumber(reportData.summary.grandTotalQuantity)} Pcs
                      </span>
                      <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--primary)" }}>
                        {formatCurrency(reportData.summary.grandTotalRevenue)}
                      </span>
                    </div>
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
