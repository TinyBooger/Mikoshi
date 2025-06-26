import React from 'react';
import { Outlet } from 'react-router';
import Sidebar from './sidebar';
import Topbar from './topbar';

export default function Layout() {
  return (
    <div className="d-flex" style={{ height: '100vh' }}>
      <Sidebar />
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        <Topbar />
        <main className="flex-grow-1 p-4 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
