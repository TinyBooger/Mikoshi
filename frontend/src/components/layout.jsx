import React from 'react';
import { Outlet } from 'react-router';
import Sidebar from './sidebar';
import Topbar from './topbar';

export default function Layout() {
  return (
    <div className="d-flex" style={{ height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div className="d-flex flex-column flex-grow-1">
        <div style={{ height: '56px', flexShrink: 0, position: 'relative', zIndex: 1040 }}>
          <Topbar />
        </div>
        <main style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
