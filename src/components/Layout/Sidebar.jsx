import { NavLink } from "react-router-dom";
import { LayoutDashboard, FileText, Package, Users, X } from "lucide-react";
import BrandLogo from "../BrandLogo";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/customers", label: "Customers", icon: Users },
];

export default function Sidebar({ isOpen = false, onClose }) {
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
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            onClick={onClose}
          >
            <Icon size={18} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer relative">v1.0.1</div>
    </aside>
  );
}
