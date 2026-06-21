import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Package,
  Users,
  X,
  LogOut,
  ShoppingCart,
  BookOpen,
} from "lucide-react";
import BrandLogo from "../BrandLogo";
import { useAuth } from "../../context/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/invoices", label: "Sales", icon: FileText, invoiceTab: "sale" },
  { to: "/inventory", label: "Inventory", icon: Package },
  {
    to: "/invoices",
    label: "Purchases",
    icon: ShoppingCart,
    invoiceTab: "purchase",
  },
  { to: "/ledger", label: "Ledger", icon: BookOpen },
  { to: "/customers", label: "Customers", icon: Users },
];

export default function Sidebar({ isOpen = false, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeInvoiceTab =
    new URLSearchParams(location.search).get("type") === "purchase"
      ? "purchase"
      : "sale";

  const handleLogout = () => {
    logout();
    onClose?.();
    navigate("/login");
  };

  return (
    <aside className={`sidebar${isOpen ? " sidebar-open" : ""}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 overflow-hidden">
        <div className="absolute -top-16 left-1/2 h-32 w-60 -translate-x-1/2 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-indigo-400/40 to-transparent" />
      </div>

      <div className="sidebar-brand relative">
        <div className="sidebar-logo">
          <BrandLogo size={40} className="sidebar-logo-icon" />
          <div className="sidebar-logo-text">
            <h1>Abros</h1>
            <span>Healthcare</span>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav relative">
        {navItems.map(({ to, label, icon: Icon, end, invoiceTab }) => {
          const linkTo =
            invoiceTab === "purchase"
              ? { pathname: to, search: "?type=purchase" }
              : invoiceTab === "sale"
                ? { pathname: to, search: "" }
                : to;
          const isActive = invoiceTab
            ? location.pathname === to && activeInvoiceTab === invoiceTab
            : undefined;

          return (
            <NavLink
              key={label}
              to={linkTo}
              end={end}
              className={({ isActive: navActive }) =>
                `nav-link${(invoiceTab ? isActive : navActive) ? " active" : ""}`
              }
              onClick={onClose}
            >
              <Icon size={18} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer relative">
        <div className="sidebar-user">{user?.name || user?.username}</div>
        <button
          type="button"
          className="sidebar-logout-btn"
          onClick={handleLogout}
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
