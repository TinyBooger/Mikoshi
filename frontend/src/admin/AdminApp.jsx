import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router";
import AdminSidebar  from "./components/AdminSidebar";
import DashboardPage from "./DashboardPage";
import UsersPage from "./UsersPage";

export default function AdminApp() {
  return (
    <div className="d-flex">
      <AdminSidebar />
      <div className="flex-grow-1 p-3">
        <Routes>
          <Route path="/admin/*" element={<DashboardPage />} />
          <Route path="/admin/users" element={<UsersPage />} />
        </Routes>
      </div>
    </div>
  );
}
