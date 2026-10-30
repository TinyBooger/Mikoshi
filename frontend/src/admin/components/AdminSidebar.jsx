import React from "react";
import { Link } from "react-router";
import ProblemReportBadge from "../../components/ProblemReportBadge";
import { useUnhandledProblemReportCount } from "../../hooks/useUnhandledProblemReportCount";

export default function AdminSidebar({ mobileOpen = false }) {
  const mobileStateClass = mobileOpen ? " mobile-open" : "";
  const { issueCount, moderationCount } = useUnhandledProblemReportCount();

  return (
    <div className={`admin-sidebar bg-dark text-white p-3${mobileStateClass}`} style={{ minWidth: 200 }}>
      <h5>Admin</h5>
      <ul className="admin-sidebar-nav nav flex-column">
        <li><Link className="nav-link text-white" to="/admin">Dashboard</Link></li>
        <li><Link className="nav-link text-white" to="/admin/user-stats">User Statistics</Link></li>
        <li><Link className="nav-link text-white" to="/admin/users">Users</Link></li>
        <li><Link className="nav-link text-white" to="/admin/content">Content Management</Link></li>
        <li><Link className="nav-link text-white" to="/admin/tags">Tags</Link></li>
        <li><Link className="nav-link text-white" to="/admin/search-terms">Search Keywords</Link></li>
        <li>
          <Link className="nav-link text-white d-flex align-items-center gap-2" to="/admin/problem-reports">
            Problem Reports
            <ProblemReportBadge count={issueCount} />
          </Link>
        </li>
        <li>
          <Link className="nav-link text-white d-flex align-items-center gap-2" to="/admin/moderation">
            Moderation
            <ProblemReportBadge count={moderationCount} />
          </Link>
        </li>
        <li><Link className="nav-link text-white" to="/admin/notifications">Announcements</Link></li>
        <li><Link className="nav-link text-white" to="/admin/user-messages">User Messages</Link></li>
        <li><Link className="nav-link text-white" to="/admin/error-logs">Error Logs</Link></li>
        <li><Link className="nav-link text-white" to="/admin/audit-logs">Audit Logs</Link></li>
        <li><Link className="nav-link text-white" to="/admin/system-settings">System Settings</Link></li>
        <li className="mt-3 pt-3 border-top border-secondary">
          <Link className="nav-link text-white-50" to="/">
            <i className="bi bi-arrow-left me-2"></i>Back to Site
          </Link>
        </li>
      </ul>
    </div>
  );
}
