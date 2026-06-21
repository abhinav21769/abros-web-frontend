import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, Package, Users, FileText } from "lucide-react";
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
  const invcStats = invoices.data.stats;

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
      label: "Customers",
      value: custStats.totalCustomers,
      sub: "Registered buyers",
    },
    {
      label: "Revenue (Paid)",
      value: formatCurrency(invcStats.totalRevenue),
      sub:
        invcStats.pendingAmount > 0
          ? `${formatCurrency(invcStats.pendingAmount)} pending`
          : null,
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
      label: "Invoices",
      value: invcStats.totalInvoices,
      sub: `${invcStats.pendingInvoices} pending · ${invcStats.paidInvoices} paid`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your pharmacy inventory and operations"
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
        delay={0.2}
        style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}
      >
        <ShimmerButton as={Link} to="/inventory">
          <Package size={16} /> Add Medicine
        </ShimmerButton>
        <Link to="/customers" className="btn btn-secondary">
          <Users size={16} /> Add Customer
        </Link>
        <Link to="/invoices" className="btn btn-secondary">
          <FileText size={16} /> Create Invoice
        </Link>
      </FadeIn>
    </>
  );
}
