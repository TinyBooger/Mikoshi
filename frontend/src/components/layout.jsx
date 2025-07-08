import React from 'react';
import { Outlet } from 'react-router';
import Sidebar from './sidebar';
import Topbar from './topbar';

export default function Layout() {
  return (
    <div className="d-flex" style={{ height: 0 }}>
      <Sidebar />
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        <div style={{ height: '56px', flexShrink: 0 }}>
          <Topbar />
        </div>
        <main className="flex-grow-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
