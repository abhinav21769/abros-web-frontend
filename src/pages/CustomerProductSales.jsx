import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  BarChart3,
  Layers,
  Search,
  Phone,
  MapPin,
  FileText,
  IndianRupee,
  Package,
  Users,
  CalendarDays,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import LottieLoader from "../components/ui/LottieLoader";
import { FadeIn } from "../components/ui/fade-in";
import { dashboardApi } from "../api/client";
import { useToast } from "../context/ToastContext";
import { downloadCsv } from "../utils/csvExport";
import logger from "../utils/logger";
import { getFinancialYear, formatCurrency } from "../utils/gstReport";
import {
  MONTH_HEADERS,
  bestMonth,
  buildCustomerSalesCsv,
  customerKey,
  filterCustomers,
  financialYearLabel,
  formatNumber,
  heatLevel,
  largestCellRevenue,
  rankCustomers,
} from "../utils/customerSales";

const EMPTY_REPORT = {
  financialYearLabel: "",
  summary: { grandTotalRevenue: 0, grandTotalQuantity: 0, activeCustomersCount: 0 },
  monthlyGrandTotals: [],
  customers: [],
};

function Qty({ quantity, free }) {
  return (
    <span className="cps-qty">
      {formatNumber(quantity)}
      {free > 0 && <em className="cps-free">+{formatNumber(free)} free</em>}
    </span>
  );
}

function MonthlyBars({ totals }) {
  const max = Math.max(0, ...totals.map((cell) => Number(cell.revenue) || 0));

  return (
    <div className="cps-bars" role="img" aria-label="Revenue by month">
      {MONTH_HEADERS.map((label, index) => {
        const revenue = Number(totals[index]?.revenue) || 0;
        const height = max > 0 ? Math.max(revenue > 0 ? 4 : 0, (revenue / max) * 100) : 0;
        return (
          <div
            key={label}
            className="cps-bar"
            title={`${label}: ${formatCurrency(revenue)}`}
          >
            <div className="cps-bar-track">
              <span
                className={`cps-bar-fill${revenue === max && max > 0 ? " is-peak" : ""}`}
                style={{ height: `${height}%` }}
              />
            </div>
            <span className="cps-bar-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function CustomerMatrix({ customer }) {
  const max = largestCellRevenue(customer);
  const best = bestMonth(customer.monthlyTotals);
  const monthlyTotals = customer.monthlyTotals || [];

  return (
    <section className="cps-customer">
      <header className="cps-customer-head">
        <div className="cps-customer-id">
          <h3>{customer.customerName}</h3>
          <div className="cps-customer-meta">
            {customer.contact && (
              <span>
                <Phone size={12} /> {customer.contact}
              </span>
            )}
            {customer.gstin && (
              <span>
                <FileText size={12} /> {customer.gstin}
              </span>
            )}
            {customer.address && (
              <span>
                <MapPin size={12} /> {customer.address}
              </span>
            )}
          </div>
        </div>

        <dl className="cps-customer-stats">
          <div>
            <dt>Units</dt>
            <dd>
              <Qty quantity={customer.totalQuantity} free={customer.totalFree} />
            </dd>
          </div>
          <div>
            <dt>Products</dt>
            <dd>{(customer.products || []).length}</dd>
          </div>
          {best && (
            <div>
              <dt>Best month</dt>
              <dd>{best.month}</dd>
            </div>
          )}
          <div className="cps-stat-revenue">
            <dt>FY revenue</dt>
            <dd>{formatCurrency(customer.totalRevenue)}</dd>
          </div>
        </dl>
      </header>

      <div className="cps-matrix-wrap">
        <table className="cps-matrix">
          <thead>
            <tr>
              <th className="cps-sticky">Product</th>
              {MONTH_HEADERS.map((month) => (
                <th key={month} className="cps-month">
                  {month}
                </th>
              ))}
              <th className="cps-total">Total</th>
            </tr>
          </thead>
          <tbody>
            {(customer.products || []).map((product) => (
              <tr key={product.id || product.medicineName}>
                <td className="cps-sticky cps-product">{product.medicineName}</td>
                {(product.monthlyData || []).map((cell, index) => {
                  const level = heatLevel(cell.revenue, max);
                  const hasData = level > 0 || cell.quantity > 0 || cell.free > 0;
                  return (
                    <td key={index} className={`cps-cell heat-${level}`}>
                      {hasData ? (
                        <>
                          <Qty quantity={cell.quantity} free={cell.free} />
                          <span className="cps-rev">{formatCurrency(cell.revenue)}</span>
                        </>
                      ) : (
                        <span className="cps-none">–</span>
                      )}
                    </td>
                  );
                })}
                <td className="cps-total">
                  <Qty quantity={product.totalQuantity} free={product.totalFree} />
                  <span className="cps-rev">{formatCurrency(product.totalRevenue)}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="cps-sticky">Monthly totals</td>
              {MONTH_HEADERS.map((month, index) => {
                const cell = monthlyTotals[index] || { quantity: 0, free: 0, revenue: 0 };
                return (
                  <td key={month} className="cps-cell">
                    <Qty quantity={cell.quantity} free={cell.free} />
                    <span className="cps-rev">{formatCurrency(cell.revenue)}</span>
                  </td>
                );
              })}
              <td className="cps-total">
                <Qty quantity={customer.totalQuantity} free={customer.totalFree} />
                <span className="cps-rev">{formatCurrency(customer.totalRevenue)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export default function CustomerProductSales() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [financialYear, setFinancialYear] = useState(getFinancialYear());
  const [availableFinancialYears, setAvailableFinancialYears] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  // null = follow the top customer, "all" = every customer, otherwise a customerKey
  const [selectedKey, setSelectedKey] = useState(null);
  const [reportData, setReportData] = useState(EMPTY_REPORT);

  const fetchReport = async (fy, isStale = () => false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.customerProductSales({ financialYear: fy });
      // Guards against a slower, superseded request (e.g. rapidly switching
      // the FY dropdown) resolving after a newer one and clobbering it.
      if (isStale()) return;
      if (res && res.data) {
        setReportData({
          financialYearLabel: res.data.financialYearLabel || financialYearLabel(fy),
          summary: res.data.summary || EMPTY_REPORT.summary,
          monthlyGrandTotals: res.data.monthlyGrandTotals || [],
          customers: res.data.customers || [],
        });

        if (res.data.availableFinancialYears && res.data.availableFinancialYears.length > 0) {
          setAvailableFinancialYears(res.data.availableFinancialYears);
        } else if (res.data.availableYears && res.data.availableYears.length > 0) {
          setAvailableFinancialYears(
            res.data.availableYears.map((y) => ({ value: y, label: financialYearLabel(y) })),
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
    fetchReport(financialYear, () => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- search is client-side only, so only the financial year refetches.
  }, [financialYear]);

  const ranked = useMemo(
    () => rankCustomers(filterCustomers(reportData.customers, searchTerm)),
    [reportData.customers, searchTerm],
  );
  const topRevenue = ranked.length ? Number(ranked[0].totalRevenue) || 0 : 0;

  // A selection the current search no longer lists falls back to the top customer.
  const effectiveKey =
    selectedKey === "all"
      ? "all"
      : ranked.some((c) => customerKey(c) === selectedKey)
        ? selectedKey
        : ranked[0]
          ? customerKey(ranked[0])
          : null;

  const displayedCustomers = useMemo(
    () =>
      effectiveKey === "all" ? ranked : ranked.filter((c) => customerKey(c) === effectiveKey),
    [ranked, effectiveKey],
  );

  const exportToCSV = () => {
    if (displayedCustomers.length === 0) {
      toast?.info?.("No sales data available to export");
      return;
    }
    const { headers, rows } = buildCustomerSalesCsv(displayedCustomers);
    const fy = reportData.financialYearLabel || financialYearLabel(financialYear);
    downloadCsv(`Customer_Product_Monthly_Sales_${fy.replace(/\s+/g, "_")}.csv`, headers, rows);
    toast?.success?.("Exported sales report to CSV");
  };

  const currentFYLabel = reportData.financialYearLabel || financialYearLabel(financialYear);
  const { summary, monthlyGrandTotals } = reportData;
  const peak = bestMonth(monthlyGrandTotals);
  const hasLoaded = reportData.customers.length > 0 || Boolean(reportData.financialYearLabel);

  return (
    <FadeIn>
      <nav className="sales-subnav" aria-label="Sales reports">
        <Link to="/product-sales">
          <BarChart3 size={16} />
          Product Sales
        </Link>
        <Link to="/customer-product-sales" className="active" aria-current="page">
          <Layers size={16} />
          Customer × Product Monthly
        </Link>
      </nav>

      <PageHeader
        title="Customer × Product Monthly Sales"
        action={
          <div className="cps-actions">
            <select
              className="cps-fy"
              aria-label="Financial year"
              value={financialYear}
              onChange={(e) => {
                setFinancialYear(Number(e.target.value));
                setSelectedKey(null);
              }}
            >
              {availableFinancialYears.length > 0 ? (
                availableFinancialYears.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))
              ) : (
                <option value={financialYear}>{financialYearLabel(financialYear)}</option>
              )}
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fetchReport(financialYear)}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={exportToCSV}
              disabled={loading || displayedCustomers.length === 0}
            >
              <FileSpreadsheet size={16} />
              Export CSV
            </button>
          </div>
        }
      />
      <p className="cps-subtitle">
        Units and revenue each customer bought, product by product and month by month, for{" "}
        {currentFYLabel}.
      </p>

      {error && !hasLoaded ? (
        <div className="card cps-state">
          <AlertCircle size={32} />
          <h3>Couldn't load the report</h3>
          <p>{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => fetchReport(financialYear)}>
            <RefreshCw size={15} />
            Try again
          </button>
        </div>
      ) : loading && !hasLoaded ? (
        <LottieLoader message="Loading monthly customer sales..." />
      ) : (
        <div className={`cps-body${loading ? " is-loading" : ""}`} aria-busy={loading}>
          <div className="cps-overview">
            <div className="cps-stats">
              <div className="cps-stat">
                <span className="cps-stat-icon">
                  <IndianRupee size={16} />
                </span>
                <span className="cps-stat-label">Total revenue</span>
                <strong>{formatCurrency(summary.grandTotalRevenue)}</strong>
              </div>
              <div className="cps-stat">
                <span className="cps-stat-icon">
                  <Package size={16} />
                </span>
                <span className="cps-stat-label">Units sold</span>
                <strong>{formatNumber(summary.grandTotalQuantity)}</strong>
              </div>
              <div className="cps-stat">
                <span className="cps-stat-icon">
                  <Users size={16} />
                </span>
                <span className="cps-stat-label">Active customers</span>
                <strong>{formatNumber(summary.activeCustomersCount)}</strong>
              </div>
              <div className="cps-stat">
                <span className="cps-stat-icon">
                  <CalendarDays size={16} />
                </span>
                <span className="cps-stat-label">Peak month</span>
                <strong>{peak ? peak.month : "–"}</strong>
                {peak && <small>{formatCurrency(peak.revenue)}</small>}
              </div>
            </div>

            <div className="cps-chart card">
              <div className="cps-chart-head">
                <h3>Revenue by month</h3>
                <span>{currentFYLabel}</span>
              </div>
              <MonthlyBars totals={monthlyGrandTotals} />
            </div>
          </div>

          <div className="cps-workspace">
            <aside className="card cps-picker">
              <label className="cps-search">
                <Search size={15} />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search customer, GSTIN or product"
                  aria-label="Search customers or products"
                />
              </label>

              <div className="cps-picker-list" role="listbox" aria-label="Customers">
                {ranked.length > 0 && (
                  <button
                    type="button"
                    role="option"
                    aria-selected={effectiveKey === "all"}
                    className={`cps-pick${effectiveKey === "all" ? " active" : ""}`}
                    onClick={() => setSelectedKey("all")}
                  >
                    <span className="cps-pick-name">All customers</span>
                    <span className="cps-pick-rev">{ranked.length}</span>
                  </button>
                )}

                {ranked.map((customer) => {
                  const key = customerKey(customer);
                  const share = topRevenue > 0 ? ((Number(customer.totalRevenue) || 0) / topRevenue) * 100 : 0;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="option"
                      aria-selected={effectiveKey === key}
                      className={`cps-pick${effectiveKey === key ? " active" : ""}`}
                      onClick={() => setSelectedKey(key)}
                    >
                      <span className="cps-pick-name">{customer.customerName}</span>
                      <span className="cps-pick-rev">{formatCurrency(customer.totalRevenue)}</span>
                      <span className="cps-pick-sub">
                        {customer.contact || customer.gstin || "No contact on file"}
                      </span>
                      <span className="cps-pick-share" aria-hidden="true">
                        <span style={{ width: `${share}%` }} />
                      </span>
                    </button>
                  );
                })}

                {ranked.length === 0 && (
                  <p className="cps-picker-empty">
                    {searchTerm.trim()
                      ? "No customer or product matches your search."
                      : `No sales recorded in ${currentFYLabel}.`}
                  </p>
                )}
              </div>
            </aside>

            <div className="cps-results">
              {displayedCustomers.length === 0 ? (
                <div className="card cps-state">
                  <Layers size={32} />
                  <h3>No product sales found</h3>
                  <p>No sale records match your criteria in {currentFYLabel}.</p>
                </div>
              ) : (
                <>
                  <p className="cps-legend">
                    Each cell shows units and revenue. Darker cells are higher revenue for that
                    customer.
                  </p>
                  {displayedCustomers.map((customer) => (
                    <CustomerMatrix key={customerKey(customer)} customer={customer} />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </FadeIn>
  );
}
