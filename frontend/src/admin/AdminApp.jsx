import React from "react";
import { Outlet } from "react-router";
import AdminSidebar  from "./components/AdminSidebar";

export default function AdminApp() {
  return (
    <div className="d-flex">
      <AdminSidebar />
      <div className="flex-grow-1 p-3">
        <Outlet />
      </div>
    </div>
  );
}
