import React from 'react';
import { Outlet } from 'react-router';
import Sidebar from './sidebar';
import Topbar from './topbar';

export default function Layout() {
  return (
    <div className="d-flex" style={{ height: '100vh' }}>
      <Sidebar />
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        {/* Topbar fixed height */}
        <div style={{ height: '56px', flexShrink: 0 }}>
          <Topbar />
        </div>

        {/* Main content should stretch */}
        <div className="flex-grow-1 d-flex overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
