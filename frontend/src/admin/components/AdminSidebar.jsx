import React from "react";
import { Link } from "react-router";

export default function AdminSidebar() {
  return (
    <div className="bg-dark text-white p-3" style={{ minWidth: 200 }}>
      <h5>Admin</h5>
      <ul className="nav flex-column">
        <li><Link className="nav-link text-white" to="/admin">Dashboard</Link></li>
        <li><Link className="nav-link text-white" to="/admin/users">Users</Link></li>
        <li><Link className="nav-link text-white" to="/admin/characters">Characters</Link></li>
        <li><Link className="nav-link text-white" to="/admin/tags">Tags</Link></li>
        <li><Link className="nav-link text-white" to="/admin/search-terms">Search Keywords</Link></li>
      </ul>
    </div>
  );
}
