import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  Package,
  Users,
  FileText,
  ShoppingCart,
  TrendingUp,
  Boxes,
  ArrowUpRight,
  PlusCircle,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import LottieLoader from "../components/ui/LottieLoader";
import { FadeIn } from "../components/ui/fade-in";
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
  if (!dateStr) return "—";
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

function StatCard({ label, value, sub, valueStyle, icon, iconBg = "var(--surface-elevated)", iconColor = "var(--primary)" }) {
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
      <div className="stat-card-value" style={valueStyle}>
        {value}
      </div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
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
    return <LottieLoader fullScreen message="Loading dashboard stats..." />;
  }

  if (loadFailed || !inventory || !customers || !invoices) {
    return (
      <div className="card" style={{ margin: "40px auto", maxWidth: 500, textAlign: "center" }}>
        <div className="card-body" style={{ padding: "40px 24px" }}>
          <AlertTriangle size={32} color="var(--warning)" style={{ marginBottom: 12 }} />
          <h3 style={{ fontSize: "1.1rem", marginBottom: 6 }}>Dashboard Data Unavailable</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Unable to fetch real-time overview metrics. Please refresh or try again.
          </p>
        </div>
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
      sub: `${invStats.totalQuantity} total units available`,
      icon: <Boxes size={18} />,
      iconBg: "#f0fdfa",
      iconColor: "#0f766e",
    },
    {
      label: "Inventory Value",
      value: formatCurrency(invStats.totalInventoryValue),
      sub: "Valued at base rate pricing",
      icon: <Package size={18} />,
      iconBg: "#f0f9ff",
      iconColor: "#0284c7",
    },
    {
      label: "Sales Revenue",
      value: formatCurrency(salesStats.totalRevenue),
      sub:
        salesStats.pendingAmount > 0
          ? `${formatCurrency(salesStats.pendingAmount)} pending balance`
          : `${salesStats.paidInvoices} settled sales`,
      icon: <TrendingUp size={18} />,
      iconBg: "#ecfdf5",
      iconColor: "#059669",
    },
    {
      label: "Purchase Orders",
      value: purchaseStats.totalInvoices,
      sub:
        purchaseStats.totalAmount > 0
          ? `${formatCurrency(purchaseStats.totalAmount)} cumulative value`
          : "No orders processed",
      icon: <ShoppingCart size={18} />,
      iconBg: "#f5f3ff",
      iconColor: "#7c3aed",
    },
  ];

  const secondaryStats = [
    {
      label: "Expired Stock",
      value: invStats.expiredStock,
      valueStyle: { color: "var(--danger)" },
      sub: "Items past expiration date",
      icon: <AlertTriangle size={18} />,
      iconBg: "#fef2f2",
      iconColor: "#dc2626",
    },
    {
      label: "Expiring Soon",
      value: invStats.expiringStock,
      valueStyle: { color: "var(--warning)" },
      sub: `Within next ${invStats.expiringWithinDays} days`,
      icon: <Clock size={18} />,
      iconBg: "#fffbeb",
      iconColor: "#d97706",
    },
    {
      label: "Low Stock Alert",
      value: invStats.lowStockCount,
      sub: "Medicines below 10 units",
      icon: <AlertTriangle size={18} />,
      iconBg: "#eff6ff",
      iconColor: "#2563eb",
    },
    {
      label: "Active Customers",
      value: custStats.totalCustomers,
      sub: `${salesStats.totalInvoices} sales · ${purchaseStats.totalInvoices} purchases`,
      icon: <Users size={18} />,
      iconBg: "#fdf4ff",
      iconColor: "#c026d3",
    },
  ];

  return (
    <>
      <PageHeader
        title="Operations Dashboard"
        subtitle="Real-time breakdown of pharmaceutical inventory, sales revenue, and purchase orders"
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/inventory" className="btn btn-primary">
              <PlusCircle size={16} /> Add Stock
            </Link>
            <Link to="/invoices" className="btn btn-secondary">
              <FileText size={16} /> New Sale
            </Link>
          </div>
        }
      />

      <FadeIn className="stats-grid" delay={0.05}>
        {primaryStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </FadeIn>

      <FadeIn className="stats-grid" delay={0.1}>
        {secondaryStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </FadeIn>

      <FadeIn className="dashboard-grid" delay={0.15}>
        <div className="card">
          <div className="card-header">
            <h3>Recent Sales</h3>
            <Link to="/invoices" className="btn btn-secondary btn-sm">
              View All <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="card-body">
            {invoices.data.sales.recent.length === 0 ? (
              <div className="empty-state">No sales recorded yet</div>
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
                          <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                            {inv.invoiceNumber}
                          </span>
                        </td>
                        <td>{inv.customer?.name || "—"}</td>
                        <td>{formatDate(inv.invoiceDate)}</td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(inv.total)}</td>
                        <td>{statusBadge(inv.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Recent Purchase Orders</h3>
            <Link to="/invoices?type=purchase" className="btn btn-secondary btn-sm">
              View All <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="card-body">
            {invoices.data.purchases.recent.length === 0 ? (
              <div className="empty-state">No purchase orders recorded yet</div>
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
                          <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                            {inv.invoiceNumber}
                          </span>
                        </td>
                        <td>{inv.supplier || "—"}</td>
                        <td>{formatDate(inv.invoiceDate)}</td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(inv.total)}</td>
                        <td>{statusBadge(inv.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </FadeIn>

      <FadeIn className="dashboard-grid" delay={0.2}>
        <div className="card">
          <div className="card-header">
            <h3>Expiring Stock Alert</h3>
            <Link to="/inventory" className="btn btn-secondary btn-sm">
              Manage Stock
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
                      <th>Expiry Date</th>
                      <th>Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.data.expiringMedicines.list.map((med, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{med.name}</td>
                        <td style={{ color: "var(--warning)", fontWeight: 600 }}>
                          {formatDate(med.expiryDate)}
                        </td>
                        <td>{med.quantity} units</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Expired Stock List</h3>
            <Link to="/inventory" className="btn btn-secondary btn-sm">
              Resolve Items
            </Link>
          </div>
          <div className="card-body">
            {inventory.data.expiredMedicines.list.length === 0 ? (
              <div className="empty-state">No expired medicines in inventory</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th>Expired On</th>
                      <th>Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.data.expiredMedicines.list.map((med, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{med.name}</td>
                        <td style={{ color: "var(--danger)", fontWeight: 600 }}>
                          {formatDate(med.expiryDate)}
                        </td>
                        <td>{med.quantity} units</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </FadeIn>
    </>
  );
}
