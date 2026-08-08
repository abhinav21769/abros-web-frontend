import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ReceiptText,
  Pill,
  BarChart3,
  Truck,
  Building2,
  Landmark,
  X,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import BrandLogo from "../BrandLogo";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: Activity, end: true },
  { to: "/invoices", label: "Sales Invoices", icon: ReceiptText, invoiceTab: "sale" },
  { to: "/inventory", label: "Medicine Inventory", icon: Pill },
  { to: "/product-sales", label: "Product Sales", icon: BarChart3 },
  {
    to: "/invoices",
    label: "Purchase Orders",
    icon: Truck,
    invoiceTab: "purchase",
  },
  { to: "/customers", label: "Client Directory", icon: Building2 },
  { to: "/gst-returns", label: "GST Tax Returns", icon: Landmark },
];

export default function Sidebar({ isOpen = false, onClose }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
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

  const userName = user?.name || user?.username || "Admin User";
  const userInitials = userName.substring(0, 2).toUpperCase();

  return (
    <aside className={`sidebar${isOpen ? " sidebar-open" : ""}`}>
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <BrandLogo size={36} />
          <div className="sidebar-logo-text">
            <h1>Abros Healthcare</h1>
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

      <nav className="sidebar-nav">
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

      <div className="sidebar-footer">
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
        >
          <div className="theme-toggle-content">
            {isDark ? <Moon size={16} className="text-teal-400" /> : <Sun size={16} className="text-amber-400" />}
            <span>{isDark ? "Dark Mode" : "Light Mode"}</span>
          </div>
          <span className={`theme-toggle-badge ${isDark ? "is-dark" : "is-light"}`}>
            {isDark ? "ON" : "OFF"}
          </span>
        </button>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{userInitials}</div>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <div style={{ lineHeight: 1.2 }}>{userName}</div>
            <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 400 }}>
              Administrator
            </span>
          </div>
        </div>

        <button
          type="button"
          className="sidebar-logout-btn"
          onClick={handleLogout}
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
