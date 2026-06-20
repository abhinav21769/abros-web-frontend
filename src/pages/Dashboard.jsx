import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, Package, Users, FileText, IndianRupee } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { medicinesApi, customersApi, invoicesApi } from "../api/client";

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

export default function Dashboard() {
  const [inventory, setInventory] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      medicinesApi.stats(30),
      customersApi.stats(),
      invoicesApi.stats(),
    ])
      .then(([inv, cust, invc]) => {
        setInventory(inv);
        setCustomers(cust);
        setInvoices(invc);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  const invStats = inventory.stats;
  const custStats = customers.stats;
  const invcStats = invoices.stats;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your pharmacy inventory and operations"
      />

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">Total Stock Items</div>
          <div className="stat-card-value">{invStats.totalStock}</div>
          <div className="stat-card-sub">{invStats.totalQuantity} units in stock</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Inventory Value</div>
          <div className="stat-card-value">
            {formatCurrency(invStats.totalInventoryValue)}
          </div>
          <div className="stat-card-sub">At MRP pricing</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Customers</div>
          <div className="stat-card-value">{custStats.totalCustomers}</div>
          <div className="stat-card-sub">Registered buyers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Revenue (Paid)</div>
          <div className="stat-card-value">
            {formatCurrency(invcStats.totalRevenue)}
          </div>
          <div className="stat-card-sub">
            {invcStats.pendingAmount > 0 &&
              `${formatCurrency(invcStats.pendingAmount)} pending`}
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">
            <AlertTriangle size={14} style={{ display: "inline", marginRight: 4 }} />
            Expired
          </div>
          <div className="stat-card-value" style={{ color: "var(--danger)" }}>
            {invStats.expiredStock}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">
            <Clock size={14} style={{ display: "inline", marginRight: 4 }} />
            Expiring Soon
          </div>
          <div className="stat-card-value" style={{ color: "var(--warning)" }}>
            {invStats.expiringStock}
          </div>
          <div className="stat-card-sub">Within {invStats.expiringWithinDays} days</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Low Stock</div>
          <div className="stat-card-value">{invStats.lowStockCount}</div>
          <div className="stat-card-sub">Items below 10 units</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Invoices</div>
          <div className="stat-card-value">{invcStats.totalInvoices}</div>
          <div className="stat-card-sub">
            {invcStats.pendingInvoices} pending · {invcStats.paidInvoices} paid
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h3>Expiring Soon</h3>
            <Link to="/inventory" className="btn btn-secondary btn-sm">
              View Inventory
            </Link>
          </div>
          <div className="card-body">
            {inventory.expiringMedicines.list.length === 0 ? (
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
                    {inventory.expiringMedicines.list.map((med, i) => (
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

        <div className="card">
          <div className="card-header">
            <h3>Expired Stock</h3>
            <Link to="/inventory" className="btn btn-secondary btn-sm">
              Manage
            </Link>
          </div>
          <div className="card-body">
            {inventory.expiredMedicines.list.length === 0 ? (
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
                    {inventory.expiredMedicines.list.map((med, i) => (
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
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link to="/inventory" className="btn btn-primary">
          <Package size={16} /> Add Medicine
        </Link>
        <Link to="/customers" className="btn btn-secondary">
          <Users size={16} /> Add Customer
        </Link>
        <Link to="/invoices" className="btn btn-secondary">
          <FileText size={16} /> Create Invoice
        </Link>
      </div>
    </>
  );
}
