import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  Package,
  Users,
  FileText,
  ShoppingCart,
  BookOpen,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import LottieLoader from "../components/ui/LottieLoader";
import { MovingBorder } from "../components/ui/moving-border";
import { SpotlightCard } from "../components/ui/spotlight-card";
import { FadeIn } from "../components/ui/fade-in";
import { ShimmerButton } from "../components/ui/shimmer-button";
import { dashboardApi } from "../api/client";
import { useToast } from "../context/ToastContext";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusBadge(status) {
  const map = {
    paid: "badge-success",
    pending: "badge-warning",
    cancelled: "badge-danger",
  };
  return (
    <span className={`badge ${map[status] || "badge-neutral"}`}>{status}</span>
  );
}

function StatCard({ label, value, sub, valueStyle, icon }) {
  return (
    <>
      <div className="stat-card-label">
        {icon}
        {label}
      </div>
      <div className="stat-card-value" style={valueStyle}>
        {value}
      </div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </>
  );
}

export default function Dashboard() {
  const toast = useToast();
  const [inventory, setInventory] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    dashboardApi
      .stats(30)
      .then((res) => {
        setInventory({ data: res.data.inventory });
        setCustomers({ data: res.data.customers });
        setInvoices({ data: res.data.invoices });
        setLoadFailed(false);
      })
      .catch((err) => {
        setLoadFailed(true);
        toast.error(err.message);
      })
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) {
    return <LottieLoader fullScreen message="Loading dashboard..." />;
  }

  if (loadFailed || !inventory || !customers || !invoices) {
    return (
      <div className="empty-state" style={{ padding: "80px 24px" }}>
        Unable to load dashboard data. Please try again.
      </div>
    );
  }

  const invStats = inventory.data.stats;
  const custStats = customers.data.stats;
  const salesStats = invoices.data.sales.stats;
  const purchaseStats = invoices.data.purchases.stats;

  const primaryStats = [
    {
      label: "Total Stock Items",
      value: invStats.totalStock,
      sub: `${invStats.totalQuantity} units in stock`,
    },
    {
      label: "Inventory Value",
      value: formatCurrency(invStats.totalInventoryValue),
      sub: "At rate pricing",
    },
    {
      label: "Sales Revenue",
      value: formatCurrency(salesStats.totalRevenue),
      sub:
        salesStats.pendingAmount > 0
          ? `${formatCurrency(salesStats.pendingAmount)} pending`
          : `${salesStats.paidInvoices} paid invoices`,
    },
    {
      label: "Purchase Orders",
      value: purchaseStats.totalInvoices,
      sub:
        purchaseStats.totalAmount > 0
          ? `${formatCurrency(purchaseStats.totalAmount)} total value`
          : "No purchase orders yet",
    },
  ];

  const secondaryStats = [
    {
      label: "Expired",
      value: invStats.expiredStock,
      valueStyle: { color: "var(--danger)" },
      icon: (
        <AlertTriangle
          size={14}
          style={{ display: "inline", marginRight: 4 }}
        />
      ),
    },
    {
      label: "Expiring Soon",
      value: invStats.expiringStock,
      valueStyle: { color: "var(--warning)" },
      sub: `Within ${invStats.expiringWithinDays} days`,
      icon: <Clock size={14} style={{ display: "inline", marginRight: 4 }} />,
    },
    {
      label: "Low Stock",
      value: invStats.lowStockCount,
      sub: "Items below 10 units",
    },
    {
      label: "Customers",
      value: custStats.totalCustomers,
      sub: `${salesStats.totalInvoices} sale · ${purchaseStats.totalInvoices} purchase`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of inventory, sales, and purchase orders"
      />

      <FadeIn className="stats-grid" delay={0.05}>
        {primaryStats.map((stat) => (
          <MovingBorder key={stat.label} className="h-full">
            <div className="stat-card border-0 bg-transparent p-5 shadow-none">
              <StatCard {...stat} />
            </div>
          </MovingBorder>
        ))}
      </FadeIn>

      <FadeIn className="stats-grid" delay={0.1}>
        {secondaryStats.map((stat) => (
          <SpotlightCard key={stat.label}>
            <div className="stat-card border-0 bg-transparent p-5 shadow-none">
              <StatCard {...stat} />
            </div>
          </SpotlightCard>
        ))}
      </FadeIn>

      <FadeIn className="dashboard-grid" delay={0.15}>
        <SpotlightCard>
          <div className="card border-0 bg-transparent shadow-none">
            <div className="card-header">
              <h3>Recent Sales</h3>
              <Link to="/invoices" className="btn btn-secondary btn-sm">
                View All
              </Link>
            </div>
            <div className="card-body">
              {invoices.data.sales.recent.length === 0 ? (
                <div className="empty-state">No sale invoices yet</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.data.sales.recent.map((inv) => (
                        <tr key={inv._id}>
                          <td>
                            <strong>{inv.invoiceNumber}</strong>
                          </td>
                          <td>{inv.customer?.name || "—"}</td>
                          <td>{formatDate(inv.invoiceDate)}</td>
                          <td>{formatCurrency(inv.total)}</td>
                          <td>{statusBadge(inv.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard>
          <div className="card border-0 bg-transparent shadow-none">
            <div className="card-header">
              <h3>Recent Purchases</h3>
              <Link
                to="/invoices?type=purchase"
                className="btn btn-secondary btn-sm"
              >
                View All
              </Link>
            </div>
            <div className="card-body">
              {invoices.data.purchases.recent.length === 0 ? (
                <div className="empty-state">No purchase orders yet</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>PO #</th>
                        <th>Supplier</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.data.purchases.recent.map((inv) => (
                        <tr key={inv._id}>
                          <td>
                            <strong>{inv.invoiceNumber}</strong>
                          </td>
                          <td>{inv.supplier || "—"}</td>
                          <td>{formatDate(inv.invoiceDate)}</td>
                          <td>{formatCurrency(inv.total)}</td>
                          <td>{statusBadge(inv.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </SpotlightCard>
      </FadeIn>

      <FadeIn className="dashboard-grid" delay={0.2}>
        <SpotlightCard>
          <div className="card border-0 bg-transparent shadow-none">
            <div className="card-header">
              <h3>Expiring Soon</h3>
              <Link to="/inventory" className="btn btn-secondary btn-sm">
                View Inventory
              </Link>
            </div>
            <div className="card-body">
              {inventory.data.expiringMedicines.list.length === 0 ? (
                <div className="empty-state">No medicines expiring soon</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Expiry</th>
                        <th>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.data.expiringMedicines.list.map((med, i) => (
                        <tr key={i}>
                          <td>{med.name}</td>
                          <td>{formatDate(med.expiryDate)}</td>
                          <td>{med.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard>
          <div className="card border-0 bg-transparent shadow-none">
            <div className="card-header">
              <h3>Expired Stock</h3>
              <Link to="/inventory" className="btn btn-secondary btn-sm">
                Manage
              </Link>
            </div>
            <div className="card-body">
              {inventory.data.expiredMedicines.list.length === 0 ? (
                <div className="empty-state">No expired medicines</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Expired</th>
                        <th>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.data.expiredMedicines.list.map((med, i) => (
                        <tr key={i}>
                          <td>{med.name}</td>
                          <td>{formatDate(med.expiryDate)}</td>
                          <td>{med.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </SpotlightCard>
      </FadeIn>

      <FadeIn
        delay={0.25}
        style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}
      >
        <ShimmerButton as={Link} to="/inventory">
          <Package size={16} /> Add Medicine
        </ShimmerButton>
        <Link to="/invoices" className="btn btn-secondary">
          <FileText size={16} /> New Sale
        </Link>
        <Link to="/invoices?type=purchase" className="btn btn-secondary">
          <ShoppingCart size={16} /> New Purchase
        </Link>
        <Link to="/ledger" className="btn btn-secondary">
          <BookOpen size={16} /> Stock Ledger
        </Link>
        <Link to="/customers" className="btn btn-secondary">
          <Users size={16} /> Customers
        </Link>
      </FadeIn>
    </>
  );
}
