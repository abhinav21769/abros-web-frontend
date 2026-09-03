import { useState, useEffect, useMemo } from "react";
import logger from "../utils/logger";
import { downloadCsv } from "../utils/csvExport";
import { Link } from "react-router-dom";
import {
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  BarChart3,
  Layers,
  Search,
  UserCheck,
  Phone,
  MapPin,
  FileText,
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
  const [selectedCustomerKey, setSelectedCustomerKey] = useState(""); // "" = prompt, "all", or customer ID/Name

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

  const fetchReport = async (fy, search = "", isStale = () => false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.customerProductSales({
        financialYear: fy,
        search,
      });
      // Guards against a slower, superseded request (e.g. rapidly switching
      // the FY dropdown) resolving after a newer one and clobbering it.
      if (isStale()) return;
      if (res && res.data) {
        const custs = res.data.customers || [];
        setReportData({
          financialYearLabel:
            res.data.financialYearLabel || `FY ${fy}-${String(fy + 1).slice(-2)}`,
          summary: res.data.summary || {},
          monthlyGrandTotals: res.data.monthlyGrandTotals || [],
          customers: custs,
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
      logger.error("Failed to load customer x product monthly sales report", err);
      setError(err.message || "Failed to load report");
      toast?.error?.(err.message || "Failed to load report");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- search is intentionally client-side only; refetching per keystroke here would be unnecessary and unpaced by a debounce.
  }, [financialYear]);

  // Active displayed customers based on dropdown selection + search term
  const displayedCustomers = useMemo(() => {
    if (!selectedCustomerKey && !searchTerm.trim()) return [];

    let list = reportData.customers;

    if (selectedCustomerKey && selectedCustomerKey !== "all") {
      list = list.filter((c) => {
        const k = c.customerId || c.customerName;
        return String(k) === String(selectedCustomerKey);
      });
    }

    if (!searchTerm.trim()) return list;

    const q = searchTerm.toLowerCase();
    return list
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
  }, [reportData.customers, selectedCustomerKey, searchTerm]);

  const exportToCSV = () => {
    const listToExport = displayedCustomers.length > 0 ? displayedCustomers : reportData.customers;

    if (!listToExport || listToExport.length === 0) {
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

    listToExport.forEach((c) => {
      (c.products || []).forEach((p) => {
        const dataArr = p.monthlyData || [];
        const cols = dataArr.flatMap((d) => [d.quantity || 0, d.revenue || 0]);
        rows.push([
          c.customerName || "",
          p.medicineName || "",
          c.contact || "",
          c.gstin || "",
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
      "GRAND TOTAL",
      "",
      "",
      "",
      ...summaryCols,
      reportData.summary.grandTotalQuantity || 0,
      reportData.summary.grandTotalRevenue || 0,
    ]);

    downloadCsv(`Customer_Product_Monthly_Sales_${fyLabel.replace(/\s+/g, "_")}.csv`, headers, rows);

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
        subtitle={`Select a customer to view their product-wise monthly sales breakdown (${currentFYLabel})`}
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
        {/* Customer Select Toolbar */}
        <div className="toolbar" style={{ flexWrap: "wrap", gap: "16px", padding: "16px 20px" }}>
          {/* Customer Selection Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "280px" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-main)", whiteSpace: "nowrap" }}>
              Select Customer / Party:
            </label>
            <select
              value={selectedCustomerKey}
              onChange={(e) => setSelectedCustomerKey(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 32px 8px 12px",
                fontSize: "0.875rem",
                fontWeight: 600,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--primary)",
                background: "var(--bg)",
                color: "var(--text-main)",
                cursor: "pointer",
                boxShadow: "0 0 0 2px rgba(15, 118, 110, 0.15)",
              }}
            >
              <option value="">-- Choose a Customer / Party --</option>
              <option value="all">📁 All Customers ({reportData.customers.length})</option>
              {reportData.customers.map((c) => {
                const k = c.customerId || c.customerName;
                return (
                  <option key={k} value={k}>
                    {c.customerName} {c.contact ? `(${c.contact})` : ""} — {formatCurrency(c.totalRevenue)}
                  </option>
                );
              })}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Search Input for Customer & Product */}
            <div style={{ position: "relative", width: "240px" }}>
              <input
                type="text"
                placeholder="Search customer or product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: "100%", paddingLeft: "32px", height: "36px", fontSize: "0.825rem" }}
              />
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-light)",
                }}
              />
            </div>

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

        {/* Content Body */}
        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <LottieLoader message="Loading Monthly Customer Sales Data..." />
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
        ) : !selectedCustomerKey && !searchTerm.trim() ? (
          /* Empty Selection Prompt */
          <div
            style={{
              padding: "70px 20px",
              textAlign: "center",
              background: "var(--surface)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "rgba(15, 118, 110, 0.1)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <UserCheck size={36} />
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)" }}>
              Select a Customer to View Monthly Sales
            </h3>
            <p
              style={{
                margin: "0 auto",
                maxWidth: "440px",
                fontSize: "0.875rem",
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              Use the dropdown above to choose a customer/party. Their product-wise monthly sales matrix for{" "}
              <strong>{currentFYLabel}</strong> will display instantly.
            </p>
          </div>
        ) : displayedCustomers.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <Layers size={44} style={{ color: "var(--text-light)", marginBottom: "12px", opacity: 0.5 }} />
            <h3 style={{ margin: "0 0 6px", fontSize: "1rem", color: "var(--text-main)", fontWeight: 600 }}>
              No Product Sales Found
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
              No product sale records match your criteria in {currentFYLabel}.
            </p>
          </div>
        ) : (
          /* Displayed Customer Sales Tables */
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "16px" }}>
            {displayedCustomers.map((cust) => (
              <div
                key={cust.customerId || cust.customerName}
                style={{
                  background: "var(--surface)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                {/* Customer Details Header Bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 20px",
                    background: "var(--surface-elevated)",
                    borderBottom: "1px solid var(--border)",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div>
                    <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                      {cust.customerName}
                    </h4>
                    <div style={{ display: "flex", gap: "16px", alignItems: "center", marginTop: "4px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {cust.contact && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Phone size={12} /> {cust.contact}
                        </span>
                      )}
                      {cust.gstin && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <FileText size={12} /> GSTIN: {cust.gstin}
                        </span>
                      )}
                      {cust.address && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <MapPin size={12} /> {cust.address}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        TOTAL UNITS BOUGHT
                      </div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)" }}>
                        {formatNumber(cust.totalQuantity)} Pcs
                        {cust.totalFree > 0 && (
                          <span style={{ fontSize: "0.76rem", color: "#e11d48", fontWeight: 700, marginLeft: "4px" }}>
                            (+{formatNumber(cust.totalFree)} Free)
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        TOTAL FY REVENUE
                      </div>
                      <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--primary)" }}>
                        {formatCurrency(cust.totalRevenue)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Product Monthly Table for this Customer */}
                <div className="product-matrix-wrap">
                  <table className="table product-matrix-table" style={{ width: "100%", tableLayout: "auto" }}>
                    <thead>
                      <tr>
                        <th style={{ minWidth: "220px", paddingLeft: "20px", textAlign: "left" }}>
                          MEDICINE / PRODUCT NAME
                        </th>
                        {MONTH_HEADERS.map((m) => (
                          <th key={m} style={{ textAlign: "center", minWidth: "85px" }}>
                            {m.toUpperCase()}
                          </th>
                        ))}
                        <th style={{ textAlign: "right", paddingRight: "20px", minWidth: "140px" }}>
                          TOTAL (QTY & SALES)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cust.products || []).map((prod) => (
                        <tr key={prod.id || prod.medicineName}>
                          <td
                            style={{
                              paddingLeft: "20px",
                              textAlign: "left",
                              fontWeight: 600,
                              fontSize: "0.86rem",
                              color: "var(--text-main)",
                            }}
                          >
                            {prod.medicineName}
                          </td>

                          {(prod.monthlyData || []).map((cell, idx) => {
                            const hasData = cell.quantity > 0 || cell.free > 0 || cell.revenue > 0;
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
                                      {cell.quantity > 0 ? `${cell.quantity} Pcs` : cell.free > 0 ? "0 Pcs" : "0"}
                                      {cell.free > 0 && (
                                        <span style={{ fontSize: "0.7rem", color: "#e11d48", fontWeight: 700, marginLeft: "3px" }}>
                                          (+{cell.free} Free)
                                        </span>
                                      )}
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

                          <td style={{ textAlign: "right", paddingRight: "20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px" }}>
                              <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text-main)" }}>
                                {formatNumber(prod.totalQuantity)} Pcs
                                {prod.totalFree > 0 && (
                                  <span style={{ fontSize: "0.72rem", color: "#e11d48", fontWeight: 700, marginLeft: "4px" }}>
                                    (+{formatNumber(prod.totalFree)} Free)
                                  </span>
                                )}
                              </span>
                              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--primary)" }}>
                                {formatCurrency(prod.totalRevenue)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr
                        style={{
                          background: "var(--surface-elevated)",
                          fontWeight: 800,
                          borderTop: "3px solid var(--border-strong)",
                        }}
                      >
                        <td style={{ paddingLeft: "20px", textAlign: "left" }}>
                          MONTHLY TOTALS
                        </td>
                        {(cust.monthlyTotals || Array(12).fill({ quantity: 0, free: 0, revenue: 0 })).map((cell, idx) => (
                          <td key={idx} style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
                              <span style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "0.82rem" }}>
                                {formatNumber(cell.quantity)} Pcs
                                {cell.free > 0 && (
                                  <span style={{ fontSize: "0.7rem", color: "#e11d48", fontWeight: 700, marginLeft: "3px" }}>
                                    (+{cell.free} Free)
                                  </span>
                                )}
                              </span>
                              <span style={{ fontSize: "0.74rem", color: "var(--primary)", fontWeight: 700 }}>
                                {formatCurrency(cell.revenue)}
                              </span>
                            </div>
                          </td>
                        ))}
                        <td style={{ textAlign: "right", paddingRight: "20px" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px" }}>
                            <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--text-main)" }}>
                              {formatNumber(cust.totalQuantity)} Pcs
                              {cust.totalFree > 0 && (
                                <span style={{ fontSize: "0.72rem", color: "#e11d48", fontWeight: 700, marginLeft: "4px" }}>
                                  (+{formatNumber(cust.totalFree)} Free)
                                </span>
                              )}
                            </span>
                            <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--primary)" }}>
                              {formatCurrency(cust.totalRevenue)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </FadeIn>
  );
}
