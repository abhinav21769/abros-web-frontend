import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import BrandLogo from "../BrandLogo";
import { GridBackground } from "../ui/grid-background";

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
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
          <Menu size={22} />
        </button>
        <div className="mobile-header-brand">
          <BrandLogo size={32} className="mobile-header-logo" />
          <span>Abros Healthcare</span>
        </div>
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
        <GridBackground className="min-h-full">
          <Outlet />
        </GridBackground>
      </main>
    </div>
  );
}
