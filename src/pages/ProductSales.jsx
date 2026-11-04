import { useState, useEffect, useMemo, Fragment } from "react";
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
  IndianRupee,
  Layers,
  Search,
  ArrowDown,
  ArrowUp,
  X,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import LottieLoader from "../components/ui/LottieLoader";
import { FadeIn } from "../components/ui/fade-in";
import { dashboardApi } from "../api/client";
import { useToast } from "../context/ToastContext";
import { downloadCsv } from "../utils/csvExport";
import logger from "../utils/logger";
import { getFinancialYear, formatCurrency } from "../utils/gstReport";
import { financialYearLabel, formatNumber, heatLevel } from "../utils/customerSales";
import {
  BREAKDOWNS,
  CELL_MODES,
  activeColumns,
  buildProductSalesCsv,
  cellFigures,
  columnTotals,
  filterProducts,
  grandTotals,
  largestCell,
  periodSeries,
  revenueShare,
  rowTotals,
  sortProducts,
} from "../utils/productSales";

const EMPTY_REPORT = {
  financialYearLabel: "",
  summary: {},
  quarterlyGrandTotals: [],
  monthlyGrandTotals: [],
  products: [],
};

function Kpi({ label, value, sub, icon: Icon, tone }) {
  return (
    <div className={`ps-kpi ps-tone-${tone}`}>
      <span className="ps-kpi-icon">
        <Icon size={18} />
      </span>
      <span className="ps-kpi-label">{label}</span>
      <strong className="ps-kpi-value" title={typeof value === "string" ? value : undefined}>
        {value}
      </strong>
      <span className="ps-kpi-sub">{sub}</span>
    </div>
  );
}

function SegmentedControl({ label, options, value, onChange }) {
  return (
    <div className="ps-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? "active" : ""}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PeriodBars({ series, selected, onSelect }) {
  const max = Math.max(0, ...series.map((point) => point.revenue));

  return (
    <div
      className="ps-bars"
      style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}
      role="group"
      aria-label="Revenue by period, select a bar to focus it"
    >
      {series.map((point) => {
        const height = max > 0 ? Math.max(point.revenue > 0 ? 4 : 0, (point.revenue / max) * 100) : 0;
        const isSelected = selected === point.column.key;
        const dimmed = selected !== "all" && !isSelected;
        return (
          <button
            key={point.column.key}
            type="button"
            className={`ps-bar${isSelected ? " is-selected" : ""}${dimmed ? " is-dimmed" : ""}`}
            aria-pressed={isSelected}
            title={`${point.column.fullLabel || point.column.label}: ${formatCurrency(point.revenue)} · ${formatNumber(point.units)} units`}
            onClick={() => onSelect(isSelected ? "all" : point.column.key)}
          >
            <span className="ps-bar-value">{point.revenue > 0 ? formatCurrency(point.revenue) : ""}</span>
            <span className="ps-bar-track">
              <span
                className={`ps-bar-fill${point.revenue === max && max > 0 ? " is-peak" : ""}`}
                style={{ height: `${height}%` }}
              />
            </span>
            <span className="ps-bar-label">{point.column.short}</span>
          </button>
        );
      })}
    </div>
  );
}

function SortHeader({ label, sortKey, current, direction, onSort, className }) {
  const active = current === sortKey;
  return (
    <th className={className} aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={`ps-sort${active ? " active" : ""}`} onClick={() => onSort(sortKey)}>
        {label}
        {active && (direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );
}

function CellValue({ cell, mode }) {
  const hasSales = cell.units > 0 || cell.revenue > 0;
  if (!hasSales) return <span className="ps-none">–</span>;

  if (mode === "quantity") return <span className="ps-primary">{formatNumber(cell.units)}</span>;
  if (mode === "revenue") return <span className="ps-primary">{formatCurrency(cell.revenue)}</span>;

  return (
    <>
      <span className="ps-primary">{formatCurrency(cell.revenue)}</span>
      <span className="ps-secondary">{formatNumber(cell.units)} pcs</span>
    </>
  );
}

function BatchBreakdown({ product, colSpan, fyLabel }) {
  return (
    <tr className="ps-batch-row">
      <td colSpan={colSpan}>
        <div className="ps-batch">
          <div className="ps-batch-head">
            <strong>Sales by batch label · {fyLabel}</strong>
            <span>
              Reflects what each sale recorded at the time, so it may not match the batches currently in
              stock (see Inventory).
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Batch no.</th>
                <th className="num">Qty sold</th>
                <th className="num">Free</th>
                <th className="num">Revenue</th>
                <th className="num">Current stock</th>
              </tr>
            </thead>
            <tbody>
              {product.batchBreakdown.map((batch) => (
                <tr key={batch.batchNumber}>
                  <td className="ps-mono">
                    {batch.batchNumber}
                    {batch.totalQuantity === 0 && <em>not sold yet</em>}
                  </td>
                  <td className="num">{formatNumber(batch.totalQuantity)}</td>
                  <td className="num ps-muted">{batch.totalFree > 0 ? formatNumber(batch.totalFree) : "–"}</td>
                  <td className="num ps-strong">{formatCurrency(batch.totalRevenue)}</td>
                  <td className="num ps-muted">
                    {batch.currentStock != null ? formatNumber(batch.currentStock) : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

export default function ProductSales() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [financialYear, setFinancialYear] = useState(getFinancialYear());
  const [availableFinancialYears, setAvailableFinancialYears] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [breakdown, setBreakdown] = useState("quarterly");
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [cellMode, setCellMode] = useState("quantity");
  const [sort, setSort] = useState({ key: "revenue", direction: "desc" });
  const [expanded, setExpanded] = useState(() => new Set());
  const [reportData, setReportData] = useState(EMPTY_REPORT);

  const toggleExpanded = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const fetchReport = async (fy, isStale = () => false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.productSales({ financialYear: fy });
      // Guards against a slower, superseded request (e.g. rapidly switching
      // the FY dropdown) resolving after a newer one and clobbering it.
      if (isStale()) return;
      if (res && res.data) {
        setReportData({
          financialYearLabel: res.data.financialYearLabel || financialYearLabel(fy),
          summary: res.data.summary || {},
          quarterlyGrandTotals: res.data.quarterlyGrandTotals || [],
          monthlyGrandTotals: res.data.monthlyGrandTotals || [],
          products: res.data.products || [],
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
    fetchReport(financialYear, () => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- search is client-side only, so only the financial year refetches.
  }, [financialYear]);

  const changeBreakdown = (value) => {
    setBreakdown(value);
    setSelectedPeriod("all");
  };

  const changeSort = (key) =>
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "name" ? "asc" : "desc" },
    );

  const products = useMemo(
    () => sortProducts(filterProducts(reportData.products, searchTerm), sort.key, sort.direction),
    [reportData.products, searchTerm, sort],
  );
  const columns = useMemo(() => activeColumns(breakdown, selectedPeriod), [breakdown, selectedPeriod]);
  const totals = useMemo(() => grandTotals(products), [products]);
  const colTotals = useMemo(() => columnTotals(products, breakdown, columns), [products, breakdown, columns]);
  const heatMax = useMemo(
    () => largestCell(products, breakdown, columns, cellMode),
    [products, breakdown, columns, cellMode],
  );
  const series = useMemo(() => periodSeries(breakdown, reportData), [breakdown, reportData]);

  const exportToCSV = () => {
    if (products.length === 0) {
      toast?.info?.("No sales data available to export");
      return;
    }
    const { headers, rows } = buildProductSalesCsv(products, breakdown, columns);
    const fy = reportData.financialYearLabel || financialYearLabel(financialYear);
    const prefix = breakdown === "monthly" ? "Monthly" : "Quarterly";
    downloadCsv(`${prefix}_Product_Sales_${fy.replace(/\s+/g, "_")}.csv`, headers, rows);
    toast?.success?.(`Exported ${prefix.toLowerCase()} sales report for ${fy} to CSV`);
  };

  const currentFYLabel = reportData.financialYearLabel || financialYearLabel(financialYear);
  const { summary } = reportData;
  const hasLoaded = Boolean(reportData.financialYearLabel);
  const focusedColumn = selectedPeriod !== "all" ? columns[0] : null;
  const periodName = breakdown === "monthly" ? "month" : "quarter";
  const colSpan = columns.length + 4;

  return (
    <FadeIn>
      <nav className="sales-subnav" aria-label="Sales reports">
        <Link to="/product-sales" className="active" aria-current="page">
          <BarChart3 size={16} />
          Product Sales
        </Link>
        <Link to="/customer-product-sales">
          <Building2 size={16} />
          Customer × Product Monthly
        </Link>
      </nav>

      <PageHeader
        title="Product Sales"
        action={
          <div className="ps-actions">
            <select
              className="ps-fy"
              aria-label="Financial year"
              value={financialYear}
              onChange={(e) => setFinancialYear(Number(e.target.value))}
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
              disabled={loading || products.length === 0}
            >
              <FileSpreadsheet size={16} />
              Export CSV
            </button>
          </div>
        }
      />
      <p className="ps-subtitle">
        Units and revenue for every product, by quarter or month, for {currentFYLabel}.
      </p>

      {!hasLoaded && loading ? (
        <LottieLoader message="Loading product sales analysis..." />
      ) : !hasLoaded && error ? (
        <div className="card ps-state">
          <AlertCircle size={32} />
          <h3>Couldn't load the report</h3>
          <p>{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => fetchReport(financialYear)}>
            <RefreshCw size={15} />
            Try again
          </button>
        </div>
      ) : (
        <div className={`ps-body${loading ? " is-loading" : ""}`} aria-busy={loading}>
          <div className="ps-overview">
            <div className="ps-kpis">
              <Kpi
                label="Annual revenue"
                value={formatCurrency(summary.grandTotalRevenue)}
                sub={currentFYLabel}
                icon={IndianRupee}
                tone="amber"
              />
              <Kpi
                label="Units sold"
                value={formatNumber((summary.grandTotalQuantity || 0) + (summary.grandTotalFree || 0))}
                sub={`${formatNumber(summary.grandTotalFree || 0)} free units included`}
                icon={TrendingUp}
                tone="green"
              />
              <Kpi
                label="Products sold"
                value={formatNumber(summary.totalProductsCount || reportData.products.length)}
                sub="With recorded sales"
                icon={Package}
                tone="blue"
              />
              <Kpi
                label="Top product"
                value={summary.topProduct || "N/A"}
                sub={summary.peakQuarter ? `Peak quarter: ${summary.peakQuarter}` : "By annual revenue"}
                icon={summary.peakQuarter ? Award : Calendar}
                tone="violet"
              />
            </div>

            <div className="card ps-chart">
              <div className="ps-chart-head">
                <h3>Revenue by {periodName}</h3>
                <span>
                  {focusedColumn ? "Select the bar again to clear" : `Select a ${periodName} to focus the table`}
                </span>
              </div>
              <PeriodBars series={series} selected={selectedPeriod} onSelect={setSelectedPeriod} />
            </div>
          </div>

          <section className="card ps-table-card">
            <div className="ps-toolbar">
              <label className="ps-search">
                <Search size={15} />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search product or customer"
                  aria-label="Search products or customers"
                />
              </label>

              <div className="ps-toolbar-right">
                {focusedColumn && (
                  <button type="button" className="ps-focus" onClick={() => setSelectedPeriod("all")}>
                    {focusedColumn.fullLabel || focusedColumn.label}
                    <X size={13} />
                  </button>
                )}
                <SegmentedControl
                  label="Breakdown"
                  options={BREAKDOWNS}
                  value={breakdown}
                  onChange={changeBreakdown}
                />
                <SegmentedControl label="Cell display" options={CELL_MODES} value={cellMode} onChange={setCellMode} />
              </div>
            </div>

            {error ? (
              <div className="ps-state ps-state-inline">
                <AlertCircle size={32} />
                <h3>Couldn't refresh the report</h3>
                <p>{error}</p>
                <button type="button" className="btn btn-secondary" onClick={() => fetchReport(financialYear)}>
                  Try again
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="ps-state ps-state-inline">
                <Package size={32} />
                <h3>No sales data found</h3>
                <p>
                  {searchTerm
                    ? `No products or customers matching "${searchTerm}" in ${currentFYLabel}.`
                    : `No sales recorded in ${currentFYLabel}.`}
                </p>
              </div>
            ) : (
              <div className="ps-matrix-wrap">
                <table className="ps-matrix">
                  <thead>
                    <tr>
                      <SortHeader
                        label="Product"
                        sortKey="name"
                        current={sort.key}
                        direction={sort.direction}
                        onSort={changeSort}
                        className="ps-sticky"
                      />
                      {columns.map((column) => (
                        <th key={column.key} className="ps-period">
                          {column.label}
                        </th>
                      ))}
                      <SortHeader
                        label="Total units"
                        sortKey="units"
                        current={sort.key}
                        direction={sort.direction}
                        onSort={changeSort}
                        className="ps-total ps-total-first"
                      />
                      <SortHeader
                        label="Total revenue"
                        sortKey="revenue"
                        current={sort.key}
                        direction={sort.direction}
                        onSort={changeSort}
                        className="ps-total"
                      />
                    </tr>
                  </thead>

                  <tbody>
                    {products.map((product, index) => {
                      const rowTotal = rowTotals(product);
                      const key = product.id || product.medicineName;
                      const hasBatches = product.batchBreakdown && product.batchBreakdown.length > 1;
                      const isOpen = hasBatches && expanded.has(key);
                      const share = revenueShare(rowTotal.revenue, totals.revenue);

                      return (
                        <Fragment key={key}>
                          <tr>
                            <td className="ps-sticky ps-product">
                              <span className="ps-rank">{index + 1}</span>
                              <span className="ps-product-name" title={product.medicineName}>
                                {product.medicineName}
                              </span>
                              {hasBatches && (
                                <button
                                  type="button"
                                  className={`ps-batch-toggle${isOpen ? " active" : ""}`}
                                  aria-expanded={isOpen}
                                  onClick={() => toggleExpanded(key)}
                                  title="Show which batch labels this product's sales were recorded against. This reflects each invoice line at the time of sale, not the batches currently in stock (see Inventory)."
                                >
                                  <Layers size={11} />
                                  {product.batchBreakdown.length} batches
                                </button>
                              )}
                            </td>

                            {columns.map((column) => {
                              const cell = cellFigures(product, breakdown, column);
                              const level = heatLevel(
                                cellMode === "quantity" ? cell.units : cell.revenue,
                                heatMax,
                              );
                              return (
                                <td key={column.key} className={`ps-cell heat-${level}`}>
                                  <CellValue cell={cell} mode={cellMode} />
                                </td>
                              );
                            })}

                            <td className="ps-total ps-total-first">
                              <span className="ps-primary">{formatNumber(rowTotal.units)}</span>
                            </td>
                            <td className="ps-total">
                              <span className="ps-primary">{formatCurrency(rowTotal.revenue)}</span>
                              <span className="ps-share" title={`${share}% of shown revenue`}>
                                <span style={{ width: `${Math.min(100, share)}%` }} />
                              </span>
                            </td>
                          </tr>
                          {isOpen && <BatchBreakdown product={product} colSpan={colSpan} fyLabel={currentFYLabel} />}
                        </Fragment>
                      );
                    })}
                  </tbody>

                  <tfoot>
                    <tr>
                      <td className="ps-sticky">
                        Grand total · {products.length} {products.length === 1 ? "product" : "products"}
                      </td>
                      {colTotals.map((cell, index) => (
                        <td key={columns[index].key} className="ps-cell">
                          <CellValue cell={cell} mode={cellMode} />
                        </td>
                      ))}
                      <td className="ps-total ps-total-first">
                        <span className="ps-primary">{formatNumber(totals.units)}</span>
                      </td>
                      <td className="ps-total">
                        <span className="ps-primary">{formatCurrency(totals.revenue)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </FadeIn>
  );
}
