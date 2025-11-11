import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../../components/AuthProvider';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCharacters: 0,
    totalTags: 0,
    totalSearchTerms: 0,
    totalInvitations: 0,
    activeInvitations: 0
  });
  const { sessionToken } = useContext(AuthContext);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, charsRes, tagsRes, termsRes, invitationsRes] = await Promise.all([
          fetch(`${window.API_BASE_URL}/api/admin/users`, {
            headers: { 'Authorization': sessionToken }
          }),
          fetch(`${window.API_BASE_URL}/api/admin/characters`, {
            headers: { 'Authorization': sessionToken }
          }),
          fetch(`${window.API_BASE_URL}/api/admin/tags`, {
            headers: { 'Authorization': sessionToken }
          }),
          fetch(`${window.API_BASE_URL}/api/admin/search-terms`, {
            headers: { 'Authorization': sessionToken }
          }),
          fetch(`${window.API_BASE_URL}/api/invitations`, {
            headers: { 'Authorization': sessionToken }
          })
        ]);

        const [users, chars, tags, terms, invitations] = await Promise.all([
          usersRes.json(),
          charsRes.json(),
          tagsRes.json(),
          termsRes.json(),
          invitationsRes.json()
        ]);

        setStats({
          totalUsers: users.length,
          totalCharacters: chars.length,
          totalTags: tags.length,
          totalSearchTerms: terms.length,
          totalInvitations: invitations.length,
          activeInvitations: invitations.filter(inv => inv.status === 'active').length
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
      }
    };

    fetchStats();
  }, [sessionToken]);

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p className="text-muted">Welcome to the admin panel. Manage your platform effectively.</p>
      
      <div className="row mt-4">
        <div className="col-md-3 mb-3">
          <div className="card border-primary">
            <div className="card-body">
              <h5 className="card-title text-primary">
                <i className="bi bi-people me-2"></i>Users
              </h5>
              <h2 className="display-4">{stats.totalUsers}</h2>
              <p className="text-muted mb-0">Total registered users</p>
            </div>
          </div>
        </div>
        
        <div className="col-md-3 mb-3">
          <div className="card border-success">
            <div className="card-body">
              <h5 className="card-title text-success">
                <i className="bi bi-person-video2 me-2"></i>Characters
              </h5>
              <h2 className="display-4">{stats.totalCharacters}</h2>
              <p className="text-muted mb-0">Total characters created</p>
            </div>
          </div>
        </div>
        
        <div className="col-md-3 mb-3">
          <div className="card border-warning">
            <div className="card-body">
              <h5 className="card-title text-warning">
                <i className="bi bi-tags me-2"></i>Tags
              </h5>
              <h2 className="display-4">{stats.totalTags}</h2>
              <p className="text-muted mb-0">Total tags in system</p>
            </div>
          </div>
        </div>
        
        <div className="col-md-3 mb-3">
          <div className="card border-info">
            <div className="card-body">
              <h5 className="card-title text-info">
                <i className="bi bi-key me-2"></i>Invitations
              </h5>
              <h2 className="display-4">{stats.activeInvitations}</h2>
              <p className="text-muted mb-0">Active invitation codes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-md-12">
          <div className="card">
            <div className="card-header bg-dark text-white">
              <h5 className="mb-0">Quick Actions</h5>
            </div>
            <div className="card-body">
              <div className="d-flex gap-2 flex-wrap">
                <a href="/admin/invitations" className="btn btn-primary">
                  <i className="bi bi-key me-2"></i>Generate Invitation Code
                </a>
                <a href="/admin/users" className="btn btn-outline-primary">
                  <i className="bi bi-people me-2"></i>Manage Users
                </a>
                <a href="/admin/characters" className="btn btn-outline-success">
                  <i className="bi bi-person-video2 me-2"></i>Manage Characters
                </a>
                <a href="/admin/tags" className="btn btn-outline-warning">
                  <i className="bi bi-tags me-2"></i>Manage Tags
                </a>
                <a href="/admin/search-terms" className="btn btn-outline-info">
                  <i className="bi bi-search me-2"></i>View Search Terms
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
