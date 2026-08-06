import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Package,
  Users,
  X,
  LogOut,
  ShoppingCart,
  FileBarChart,
  Sun,
  Moon,
} from "lucide-react";
import BrandLogo from "../BrandLogo";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/invoices", label: "Sales Invoices", icon: FileText, invoiceTab: "sale" },
  { to: "/inventory", label: "Inventory Stock", icon: Package },
  {
    to: "/invoices",
    label: "Purchase Orders",
    icon: ShoppingCart,
    invoiceTab: "purchase",
  },
  { to: "/customers", label: "Customer Directory", icon: Users },
  { to: "/gst-returns", label: "GST Returns & Tax", icon: FileBarChart },
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
