import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { GridBackground } from "../ui/grid-background";

export default function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <GridBackground className="min-h-full">
          <Outlet />
        </GridBackground>
      </main>
    </div>
  );
}
