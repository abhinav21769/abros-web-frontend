import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  CalendarRange,
  Download,
  ExternalLink,
  Landmark,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import LottieLoader from "../components/ui/LottieLoader";
import { FadeIn } from "../components/ui/fade-in";
import { gstApi } from "../api/client";
import { useToast } from "../context/ToastContext";
import { downloadCsv } from "../utils/csvExport";
import { formatCalendarDate } from "../utils/dateUtils";
import {
  MONTHS,
  PERIOD_TYPES,
  QUARTERS,
  REGISTRATION_FILTERS,
  buildFinancialYearOptions,
  buildGstCsv,
  buildSummaryParams,
  filterInvoices,
  formatCurrency,
  getFinancialYear,
  getQuarter,
  gstCsvFilename,
  monthsInQuarter,
  percentOf,
  sumInvoices,
} from "../utils/gstReport";

function statusBadge(status) {
  if (status === "paid") return <span className="badge badge-success">Paid</span>;
  if (status === "pending") return <span className="badge badge-warning">Pending</span>;
  return <span className="badge badge-neutral">{status || "—"}</span>;
}

function SegmentCard({ title, icon: Icon, tone, bucket, shareOfTaxable }) {
  return (
    <section className={`gst-segment gst-tone-${tone}`}>
      <header className="gst-segment-head">
        <span className="gst-segment-icon">
          <Icon size={16} />
        </span>
        <h3>{title}</h3>
        <span className="gst-segment-count">{bucket.invoiceCount} invoices</span>
      </header>
      <div className="gst-segment-value">{formatCurrency(bucket.gst)}</div>
      <div className="gst-segment-caption">
        GST on {formatCurrency(bucket.subtotal)} taxable · {shareOfTaxable}% of sales
      </div>
      <dl className="gst-segment-split">
        <div>
          <dt>CGST</dt>
          <dd>{formatCurrency(bucket.cgst)}</dd>
        </div>
        <div>
          <dt>SGST</dt>
          <dd>{formatCurrency(bucket.sgst)}</dd>
        </div>
        <div>
          <dt>Invoiced</dt>
          <dd>{formatCurrency(bucket.total)}</dd>
        </div>
      </dl>
    </section>
  );
}

export default function GstReturns() {
  const toast = useToast();
  const financialYearOptions = useMemo(() => buildFinancialYearOptions(), []);

  const [financialYear, setFinancialYear] = useState(getFinancialYear());
  const [periodType, setPeriodType] = useState("quarterly");
  const [quarter, setQuarter] = useState(getQuarter());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const [registration, setRegistration] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await gstApi.quarterlySummary(
        buildSummaryParams({ financialYear, periodType, quarter, month }),
      );
      setData(res.data);
    } catch (err) {
      toast.error(err.message);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [financialYear, periodType, quarter, month, toast]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Any change of period makes the in-table month filter meaningless, so reset it with the change.
  const changePeriod = (setter) => (value) => {
    setter(value);
    setMonthFilter("all");
  };

  const visibleInvoices = useMemo(
    () => filterInvoices(data?.invoices, { registration, month: monthFilter, search }),
    [data, registration, monthFilter, search],
  );

  // Tab counts ignore the registration filter itself, so every tab shows what it would hold.
  const tabCounts = useMemo(() => {
    const scoped = filterInvoices(data?.invoices, { month: monthFilter, search });
    return {
      all: scoped.length,
      gst: scoped.filter((invoice) => invoice.registrationType === "gst").length,
      "non-gst": scoped.filter((invoice) => invoice.registrationType === "non-gst").length,
    };
  }, [data, monthFilter, search]);

  const totals = useMemo(() => sumInvoices(visibleInvoices), [visibleInvoices]);

  const handleExport = () => {
    const { headers, rows } = buildGstCsv(visibleInvoices, formatCalendarDate);
    downloadCsv(gstCsvFilename(data.period), headers, rows);
    toast.success(`Exported ${rows.length} invoices`);
  };

  const summary = data?.summary;
  const period = data?.period;
  const taxable = summary ? Number(summary.combined.subtotal) : 0;
  const b2bShare = summary ? percentOf(summary.gstRegistered.subtotal, taxable) : 0;
  const b2cShare = summary ? Math.round((100 - b2bShare) * 10) / 10 : 0;
  const hasSales = summary ? summary.combined.invoiceCount > 0 : false;

  return (
    <>
      <PageHeader
        title="GST Tax Returns & Reports"
        action={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExport}
            disabled={!data || visibleInvoices.length === 0}
          >
            <Download size={16} />
            Export CSV
          </button>
        }
      />
      <p className="gst-subtitle">
        GSTR-1 outward supplies for the period, split into B2B registered and B2C retail sales.
      </p>

      <FadeIn className="card gst-period-card" delay={0.05}>
        <div className="gst-period-top">
          <label className="gst-field">
            <span>Financial year</span>
            <select
              value={financialYear}
              onChange={(e) => changePeriod(setFinancialYear)(Number(e.target.value))}
            >
              {financialYearOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="gst-field">
            <span>View by</span>
            <div className="gst-segmented" role="tablist" aria-label="Period type">
              {PERIOD_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  role="tab"
                  aria-selected={periodType === type.value}
                  className={periodType === type.value ? "active" : ""}
                  onClick={() => changePeriod(setPeriodType)(type.value)}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {period && (
            <div className="gst-period-banner">
              <CalendarRange size={16} />
              <div>
                <strong>{period.label}</strong>
                <span>
                  {formatCalendarDate(period.fromDate)} – {formatCalendarDate(period.toDate)}
                </span>
              </div>
            </div>
          )}
        </div>

        {periodType === "quarterly" && (
          <div className="gst-chips" role="group" aria-label="Filing quarter">
            {QUARTERS.map((q) => (
              <button
                key={q.value}
                type="button"
                className={`gst-chip${quarter === q.value ? " active" : ""}`}
                aria-pressed={quarter === q.value}
                onClick={() => changePeriod(setQuarter)(q.value)}
              >
                <strong>{q.label}</strong>
                <span>{q.range}</span>
              </button>
            ))}
          </div>
        )}

        {periodType === "monthly" && (
          <div className="gst-chips gst-chips-months" role="group" aria-label="Filing month">
            {MONTHS.map((m) => (
              <button
                key={m.value}
                type="button"
                className={`gst-chip gst-chip-compact${month === m.value ? " active" : ""}`}
                aria-pressed={month === m.value}
                title={`${m.name} (Q${m.quarter})`}
                onClick={() => changePeriod(setMonth)(m.value)}
              >
                <strong>{m.short}</strong>
                <span>Q{m.quarter}</span>
              </button>
            ))}
          </div>
        )}
      </FadeIn>

      {!data && loading && <LottieLoader message="Calculating GST tax returns..." />}

      {!data && failed && !loading && (
        <div className="card gst-error">
          <AlertCircle size={28} />
          <h3>GST return data unavailable</h3>
          <p>We couldn't load the tax summary for this period.</p>
          <button type="button" className="btn btn-primary" onClick={loadSummary}>
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      )}

      {data && (
        <div className={`gst-results${loading ? " is-loading" : ""}`} aria-busy={loading}>
          <FadeIn className="gst-overview" delay={0.1}>
            <section className="gst-hero">
              <div className="gst-hero-label">
                <Landmark size={16} />
                Total GST collected
              </div>
              <div className="gst-hero-value">{formatCurrency(summary.combined.gst)}</div>
              <div className="gst-hero-caption">
                on {formatCurrency(summary.combined.subtotal)} taxable sales across{" "}
                {summary.combined.invoiceCount}{" "}
                {summary.combined.invoiceCount === 1 ? "invoice" : "invoices"}
              </div>

              <dl className="gst-hero-split">
                <div>
                  <dt>CGST</dt>
                  <dd>{formatCurrency(summary.combined.cgst)}</dd>
                </div>
                <div>
                  <dt>SGST</dt>
                  <dd>{formatCurrency(summary.combined.sgst)}</dd>
                </div>
                <div>
                  <dt>Invoiced total</dt>
                  <dd>{formatCurrency(summary.combined.total)}</dd>
                </div>
              </dl>

              {hasSales ? (
                <div className="gst-share">
                  <div className="gst-share-bar" aria-hidden="true">
                    <span className="gst-share-b2b" style={{ width: `${b2bShare}%` }} />
                    <span className="gst-share-b2c" style={{ width: `${b2cShare}%` }} />
                  </div>
                  <div className="gst-share-legend">
                    <span>
                      <i className="gst-dot gst-dot-b2b" /> B2B {b2bShare}%
                    </span>
                    <span>
                      <i className="gst-dot gst-dot-b2c" /> B2C {b2cShare}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="gst-hero-empty">No sales recorded in this period.</div>
              )}
            </section>

            <SegmentCard
              title="B2B · Registered"
              icon={Building2}
              tone="b2b"
              bucket={summary.gstRegistered}
              shareOfTaxable={b2bShare}
            />
            <SegmentCard
              title="B2C · Retail"
              icon={User}
              tone="b2c"
              bucket={summary.nonGstRegistered}
              shareOfTaxable={hasSales ? b2cShare : 0}
            />
          </FadeIn>

          <FadeIn className="card gst-table-card" delay={0.15}>
            <div className="gst-toolbar">
              <div className="gst-segmented" role="tablist" aria-label="Registration type">
                {REGISTRATION_FILTERS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={registration === tab.id}
                    className={registration === tab.id ? "active" : ""}
                    onClick={() => setRegistration(tab.id)}
                  >
                    {tab.label} <em>{tabCounts[tab.id]}</em>
                  </button>
                ))}
              </div>

              <div className="gst-toolbar-right">
                {periodType === "quarterly" && (
                  <div className="gst-segmented gst-segmented-sm" role="group" aria-label="Month">
                    <button
                      type="button"
                      className={monthFilter === "all" ? "active" : ""}
                      onClick={() => setMonthFilter("all")}
                    >
                      All months
                    </button>
                    {monthsInQuarter(quarter).map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        className={monthFilter === String(m.value) ? "active" : ""}
                        onClick={() => setMonthFilter(String(m.value))}
                      >
                        {m.short}
                      </button>
                    ))}
                  </div>
                )}

                <label className="gst-search">
                  <Search size={15} />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search invoice, customer or GSTIN"
                    aria-label="Search invoices"
                  />
                </label>
              </div>
            </div>

            <div className="table-wrap">
              {visibleInvoices.length === 0 ? (
                <div className="empty-state">
                  {search || registration !== "all" || monthFilter !== "all"
                    ? "No invoices match these filters."
                    : "No sales invoices were raised in this period."}
                </div>
              ) : (
                <table className="gst-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th>Customer / Recipient</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th className="num">Taxable</th>
                      <th className="num">CGST</th>
                      <th className="num">SGST</th>
                      <th className="num">Total</th>
                      <th aria-label="Open" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleInvoices.map((invoice) => (
                      <tr key={invoice._id}>
                        <td className="gst-invoice-no">{invoice.invoiceNumber}</td>
                        <td>{formatCalendarDate(invoice.invoiceDate)}</td>
                        <td>
                          <div className="gst-customer">{invoice.customerName}</div>
                          {invoice.customerGstin && (
                            <div className="gst-gstin">{invoice.customerGstin}</div>
                          )}
                        </td>
                        <td>
                          {invoice.registrationType === "gst" ? (
                            <span className="badge badge-success">B2B</span>
                          ) : (
                            <span className="badge badge-neutral">B2C</span>
                          )}
                        </td>
                        <td>{statusBadge(invoice.status)}</td>
                        <td className="num">{formatCurrency(invoice.subtotal)}</td>
                        <td className="num">{formatCurrency(invoice.cgst)}</td>
                        <td className="num">{formatCurrency(invoice.sgst)}</td>
                        <td className="num gst-row-total">{formatCurrency(invoice.total)}</td>
                        <td>
                          <Link
                            to="/invoices"
                            className="btn btn-ghost btn-sm"
                            title="Open invoices"
                            aria-label={`Open invoices for ${invoice.invoiceNumber}`}
                          >
                            <ExternalLink size={15} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5}>
                        Total · {totals.count} {totals.count === 1 ? "invoice" : "invoices"}
                      </td>
                      <td className="num">{formatCurrency(totals.subtotal)}</td>
                      <td className="num">{formatCurrency(totals.cgst)}</td>
                      <td className="num">{formatCurrency(totals.sgst)}</td>
                      <td className="num gst-row-total">{formatCurrency(totals.total)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </FadeIn>
        </div>
      )}
    </>
  );
}
