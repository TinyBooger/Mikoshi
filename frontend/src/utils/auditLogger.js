/**
 * Admin Audit Log API client
 */

export class AuditLogger {
  constructor() {
    this.apiBaseUrl = null;
  }

  init() {
    this.apiBaseUrl = window.API_BASE_URL;
  }

  getSessionToken() {
    try {
      return localStorage.getItem('sessionToken');
    } catch {
      return null;
    }
  }

  async getLogs(options = {}) {
    try {
      if (!this.apiBaseUrl) this.init();

      const params = new URLSearchParams();
      if (options.user_id) params.append('user_id', options.user_id);
      if (options.action) params.append('action', options.action);
      if (options.status) params.append('status', options.status);
      if (options.start_date) params.append('start_date', options.start_date);
      if (options.end_date) params.append('end_date', options.end_date);
      if (options.limit) params.append('limit', options.limit);
      if (options.offset !== undefined) params.append('offset', options.offset);

      const response = await fetch(
        `${this.apiBaseUrl}/api/audit-logs?${params.toString()}`,
        {
          headers: {
            'Authorization': this.getSessionToken() || '',
          },
        }
      );

      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error('[AuditLogger] Failed to fetch logs:', err);
    }
    return null;
  }
}

export const auditLogger = new AuditLogger();
