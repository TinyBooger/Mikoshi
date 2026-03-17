import React, { useState } from "react";
import { Outlet } from "react-router";
import AdminSidebar  from "./components/AdminSidebar";
import "./admin-mobile.css";

export default function AdminApp() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="admin-shell d-flex" style={{ height: '100vh', overflow: 'hidden' }}>
      <button
        type="button"
        className="admin-mobile-toggle btn btn-dark d-md-none"
        onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
      >
        {isMobileSidebarOpen ? "Hide Menu" : "Show Menu"}
      </button>
      <AdminSidebar mobileOpen={isMobileSidebarOpen} />
      <div className="admin-content flex-grow-1 p-3" style={{ height: '100vh', overflowY: 'auto' }}>
        <Outlet />
      </div>
    </div>
  );
}
