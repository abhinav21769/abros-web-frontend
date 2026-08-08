import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, Sun, Moon } from "lucide-react";
import Sidebar from "./Sidebar";
import BrandLogo from "../BrandLogo";
import { useTheme } from "../../context/ThemeContext";

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { toggleTheme, isDark } = useTheme();
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="app-layout">
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <div className="mobile-header-brand">
          <div className="mobile-header-logo-glow">
            <BrandLogo size={28} />
          </div>
          <span className="mobile-header-title">Abros Healthcare</span>
        </div>

        <button
          type="button"
          className="mobile-menu-btn"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="mobile-header-accent-bar" />
      </header>

      {menuOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      <Sidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
