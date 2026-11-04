import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Hourglass,
  PlusCircle,
  ReceiptText,
  RefreshCw,
  Truck,
  Warehouse,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import LottieLoader from "../components/ui/LottieLoader";
import { FadeIn } from "../components/ui/fade-in";
import { dashboardApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatCalendarDate, formatDateTime } from "../utils/dateUtils";
import { formatCurrency } from "../utils/gstReport";
import {
  buildAlerts,
  collectionBreakdown,
  daysUntil,
  describeExpiry,
  expiryTone,
  formatRecentDate,
  greeting,
  inventoryHealth,
} from "../utils/dashboardMetrics";

const STATUS_BADGE = {
  paid: "badge-success",
  pending: "badge-warning",
  cancelled: "badge-danger",
};

function StatusBadge({ status, item }) {
  const isPaid = String(status || "").toLowerCase() === "paid";
  const paidAt = item?.paidAt || (isPaid ? item?.updatedAt || item?.invoiceDate : null);
  const paidOn = paidAt ? formatDateTime(paidAt) : "";
  const hasTooltip = isPaid && paidOn;

  return (
    <span
      className={`badge ${STATUS_BADGE[status] || "badge-neutral"}${hasTooltip ? " badge-has-tooltip" : ""}`}
      title={hasTooltip ? `Paid on: ${paidOn}` : undefined}
    >
      {status}
      {hasTooltip && <span className="badge-tooltip">Paid on: {paidOn}</span>}
    </span>
  );
}

function Kpi({ label, value, sub, icon: Icon, tone }) {
  return (
    <div className={`dash-kpi dash-tone-${tone}`}>
      <span className="dash-kpi-icon">
        <Icon size={18} />
      </span>
      <span className="dash-kpi-label">{label}</span>
      <strong className="dash-kpi-value">{value}</strong>
      <span className="dash-kpi-sub">{sub}</span>
    </div>
  );
}

function PanelHeader({ title, count, to, cta }) {
  return (
    <div className="card-header">
      <h3>
        {title}
        {count > 0 && <span className="dash-count">{count}</span>}
      </h3>
      <Link to={to} className="btn btn-secondary btn-sm">
        {cta} <ArrowUpRight size={14} />
      </Link>
    </div>
  );
}

function InvoiceTable({ rows, partyLabel, partyOf, numberLabel, emptyText, now }) {
  if (rows.length === 0) return <div className="empty-state">{emptyText}</div>;

  return (
    <div className="table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            <th>{numberLabel}</th>
            <th>{partyLabel}</th>
            <th>Date</th>
            <th className="num">Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((invoice) => (
            <tr key={invoice._id}>
              <td className="dash-ref">{invoice.invoiceNumber}</td>
              <td className="dash-party" title={partyOf(invoice) || undefined}>
                {partyOf(invoice) || "—"}
              </td>
              <td>{formatRecentDate(invoice.invoiceDate, now)}</td>
              <td className="num dash-strong">{formatCurrency(invoice.total)}</td>
              <td>
                <StatusBadge status={invoice.status} item={invoice} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpiryTable({ rows, emptyText, now }) {
  if (rows.length === 0) {
    return (
      <div className="dash-clear">
        <CheckCircle2 size={22} />
        {emptyText}
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Batch</th>
            <th className="num">Qty</th>
            <th>Expiry</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((med) => {
            const days = daysUntil(med.expiryDate, now);
            return (
              <tr key={`${med._id}-${med.batchNumber}`}>
                <td>
                  <div className="dash-strong">{med.name}</div>
                  {med.manufacturer && <div className="dash-muted">{med.manufacturer}</div>}
                </td>
                <td className="dash-mono">{med.batchNumber || "—"}</td>
                <td className="num">{med.quantity}</td>
                <td>
                  <span className={`dash-expiry dash-expiry-${expiryTone(days)}`}>
                    {describeExpiry(days)}
                  </span>
                  <div className="dash-muted">{formatCalendarDate(med.expiryDate)}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const toast = useToast();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    return dashboardApi
      .stats(180)
      .then((res) => {
        setStats(res.data);
      })
      .catch((err) => {
        toast.error(err.message);
      })
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchData flags loading up front so a refresh shows immediately.
    fetchData();
  }, [fetchData]);

  const now = useMemo(() => new Date(), [stats]); // eslint-disable-line react-hooks/exhaustive-deps -- re-read the clock whenever fresh data arrives

  if (!stats) {
    if (loading) return <LottieLoader fullScreen message="Loading operational metrics..." />;

    return (
      <div className="card dash-failed">
        <AlertTriangle size={32} />
        <h3>Dashboard data unavailable</h3>
        <p>We couldn't fetch the overview metrics. Check your connection and try again.</p>
        <button type="button" className="btn btn-primary" onClick={fetchData}>
          <RefreshCw size={16} />
          Try again
        </button>
      </div>
    );
  }

  const inventory = stats.inventory.stats;
  const sales = stats.invoices.sales.stats;
  const purchases = stats.invoices.purchases.stats;
  const customers = stats.customers.stats;

  const alerts = buildAlerts({ inventory, sales });
  const collection = collectionBreakdown(sales);
  const health = inventoryHealth(inventory);
  const firstName = String(user?.name || "").trim().split(/\s+/)[0];

  return (
    <>
      <PageHeader
        title="Operations Dashboard"
        action={
          <div className="dash-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              Refresh
            </button>
            <Link to="/invoices" className="btn btn-secondary">
              <FileText size={16} /> New Sale
            </Link>
            <Link to="/inventory" className="btn btn-primary">
              <PlusCircle size={16} /> Add Stock
            </Link>
          </div>
        }
      />
      <p className="dash-subtitle">
        {greeting(now)}
        {firstName ? `, ${firstName}` : ""}. Here is how the business stands today,{" "}
        {now.toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "Asia/Kolkata",
        })}
        .
      </p>

      <div className={`dash-body${loading ? " is-loading" : ""}`} aria-busy={loading}>
        <FadeIn className="dash-alerts" delay={0.03}>
          {alerts.length === 0 ? (
            <div className="dash-alert dash-alert-clear">
              <CheckCircle2 size={22} />
              <div>
                <strong>All clear</strong>
                <span>No expired or expiring stock, low stock or unpaid sales.</span>
              </div>
            </div>
          ) : (
            alerts.map((alert) => (
              <Link key={alert.id} to={alert.to} className={`dash-alert dash-alert-${alert.tone}`}>
                <span className="dash-alert-count">{alert.count}</span>
                <div>
                  <strong>{alert.title}</strong>
                  <span>{alert.detail}</span>
                </div>
                <em>
                  {alert.cta} <ArrowUpRight size={13} />
                </em>
              </Link>
            ))
          )}
        </FadeIn>

        <FadeIn className="dash-kpis" delay={0.06}>
          <Kpi
            label="Sales revenue"
            value={formatCurrency(sales.totalRevenue)}
            sub={`${sales.paidInvoices} paid of ${sales.totalInvoices} sales`}
            icon={ReceiptText}
            tone="green"
          />
          <Kpi
            label="Pending collections"
            value={formatCurrency(sales.pendingAmount)}
            sub={
              sales.pendingInvoices > 0
                ? `${sales.pendingInvoices} unpaid ${sales.pendingInvoices === 1 ? "invoice" : "invoices"}`
                : "Nothing outstanding"
            }
            icon={Hourglass}
            tone="amber"
          />
          <Kpi
            label="Inventory value"
            value={formatCurrency(inventory.totalInventoryValue)}
            sub={`${inventory.totalStock} products · ${inventory.totalQuantity} units`}
            icon={Warehouse}
            tone="blue"
          />
          <Kpi
            label="Purchases"
            value={formatCurrency(purchases.totalAmount)}
            sub={
              Number(purchases.pendingAmount) > 0
                ? `${formatCurrency(purchases.pendingAmount)} still to pay`
                : `${purchases.totalInvoices} orders · ${customers.totalCustomers} clients`
            }
            icon={Truck}
            tone="violet"
          />
        </FadeIn>

        <FadeIn className="dash-insights" delay={0.1}>
          <section className="card dash-insight">
            <div className="card-header">
              <h3>Collections</h3>
              <span className="dash-muted">{formatCurrency(collection.billed)} billed</span>
            </div>
            <div className="dash-insight-body">
              <div className="dash-split-bar" aria-hidden="true">
                <span className="dash-split-paid" style={{ width: `${collection.paidPercent}%` }} />
                <span
                  className="dash-split-pending"
                  style={{ width: `${collection.pendingPercent}%` }}
                />
              </div>
              <dl className="dash-split-legend">
                <div>
                  <dt>
                    <i className="dash-dot dash-dot-paid" /> Collected
                  </dt>
                  <dd>{formatCurrency(collection.paid)}</dd>
                  <small>{collection.paidPercent}%</small>
                </div>
                <div>
                  <dt>
                    <i className="dash-dot dash-dot-pending" /> Pending
                  </dt>
                  <dd>{formatCurrency(collection.pending)}</dd>
                  <small>{collection.pendingPercent}%</small>
                </div>
              </dl>
              {sales.cancelledInvoices > 0 && (
                <p className="dash-muted">
                  {sales.cancelledInvoices} cancelled{" "}
                  {sales.cancelledInvoices === 1 ? "invoice is" : "invoices are"} not counted.
                </p>
              )}
            </div>
          </section>

          <section className="card dash-insight">
            <div className="card-header">
              <h3>Inventory health</h3>
              <span className="dash-muted">{inventory.totalStock} products</span>
            </div>
            <div className="dash-insight-body">
              {health.map((row) => (
                <div key={row.id} className="dash-meter">
                  <div className="dash-meter-top">
                    <span>{row.label}</span>
                    <strong>
                      {row.value} <small>of {row.of}</small>
                    </strong>
                  </div>
                  <div className="dash-meter-track" aria-hidden="true">
                    <span className={`dash-meter-fill dash-meter-${row.tone}`} style={{ width: `${row.percent}%` }} />
                  </div>
                </div>
              ))}
              <div className="dash-batch-counts">
                <span className="dash-expiry dash-expiry-danger">{inventory.expiredStock} expired batches</span>
                <span className="dash-expiry dash-expiry-warning">
                  {inventory.expiringStock} expiring in {inventory.expiringWithinDays} days
                </span>
              </div>
            </div>
          </section>
        </FadeIn>

        <FadeIn className="dash-grid" delay={0.14}>
          <section className="card">
            <PanelHeader title="Recent sales" to="/invoices" cta="View all" />
            <div className="card-body">
              <InvoiceTable
                rows={stats.invoices.sales.recent}
                numberLabel="Invoice #"
                partyLabel="Customer"
                partyOf={(invoice) => invoice.customer?.name}
                emptyText="No sales recorded yet"
                now={now}
              />
            </div>
          </section>

          <section className="card">
            <PanelHeader title="Recent purchase orders" to="/invoices?type=purchase" cta="View all" />
            <div className="card-body">
              <InvoiceTable
                rows={stats.invoices.purchases.recent}
                numberLabel="PO #"
                partyLabel="Supplier"
                partyOf={(invoice) => invoice.supplier}
                emptyText="No purchase orders recorded yet"
                now={now}
              />
            </div>
          </section>
        </FadeIn>

        <FadeIn className="dash-grid" delay={0.18}>
          <section className="card">
            <PanelHeader
              title="Expiring soon"
              count={stats.inventory.expiringMedicines.count}
              to="/inventory"
              cta="Manage stock"
            />
            <div className="card-body">
              <ExpiryTable
                rows={stats.inventory.expiringMedicines.list}
                emptyText={`Nothing expires in the next ${inventory.expiringWithinDays} days`}
                now={now}
              />
            </div>
          </section>

          <section className="card">
            <PanelHeader
              title="Expired batches"
              count={stats.inventory.expiredMedicines.count}
              to="/inventory"
              cta="Resolve"
            />
            <div className="card-body">
              <ExpiryTable
                rows={stats.inventory.expiredMedicines.list}
                emptyText="No expired medicines in inventory"
                now={now}
              />
            </div>
          </section>
        </FadeIn>
      </div>
    </>
  );
}
