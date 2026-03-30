import React, { useEffect, useState } from 'react';
import { AuthContext } from '../../components/AuthProvider';

function SystemSettingsPage() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const { sessionToken } = React.useContext(AuthContext);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/admin/system-settings`, {
        headers:{
            'Authorization': sessionToken
        }
      });
      if (!res.ok) throw new Error('Failed to fetch system settings');
      const data = await res.json();
      setSettings(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const startEdit = (key, value) => {
    setEditKey(key);
    setEditValue(value);
    setSuccess(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditKey(null);
    setEditValue('');
    setError(null);
    setSuccess(null);
  };

  const saveEdit = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/admin/system-settings/${encodeURIComponent(editKey)}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': sessionToken
        },
        body: JSON.stringify({ value: editValue }),
      });
      if (!res.ok) throw new Error('Failed to update setting');
      setSuccess('保存成功');
      setEditKey(null);
      setEditValue('');
      fetchSettings();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="container py-4">
      <h2 className="mb-4">系统设置管理</h2>
      {loading ? (
        <div>正在加载...</div>
      ) : error ? (
        <div className="text-danger">{error}</div>
      ) : (
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => (
              <tr key={s.key}>
                <td>{s.key}</td>
                <td style={{ maxWidth: 400 }}>
                  {editKey === s.key ? (
                    <textarea
                      className="form-control"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      rows={3}
                    />
                  ) : (
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>{s.value}</pre>
                  )}
                </td>
                <td>
                  {editKey === s.key ? (
                    <>
                      <button className="btn btn-success btn-sm me-2" onClick={saveEdit} disabled={saving}>保存</button>
                      <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>取消</button>
                    </>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={() => startEdit(s.key, s.value)}>编辑</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {success && <div className="text-success mt-2">{success}</div>}
    </div>
  );
}

export default SystemSettingsPage;
