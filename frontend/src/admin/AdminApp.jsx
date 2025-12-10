import React from "react";
import { Outlet } from "react-router";
import AdminSidebar  from "./components/AdminSidebar";

export default function AdminApp() {
  return (
    <div className="d-flex" style={{ height: '100vh', overflow: 'hidden' }}>
      <AdminSidebar />
      <div className="flex-grow-1 p-3" style={{ height: '100vh', overflowY: 'auto' }}>
        <Outlet />
      </div>
    </div>
  );
}
