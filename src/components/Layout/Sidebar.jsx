import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Package,
  Users,
  Cross,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/customers", label: "Customers", icon: Users },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Cross size={22} strokeWidth={2.5} />
          </div>
          <div className="sidebar-logo-text">
            <h1>Abros</h1>
            <span>Healthcare</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `nav-link${isActive ? " active" : ""}`
            }
          >
            <Icon size={18} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        Medicine Inventory System v1.0
      </div>
    </aside>
  );
}
