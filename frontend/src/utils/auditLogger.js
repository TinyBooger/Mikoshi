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

  /**
   * Fetch one page of audit logs.
   *
   * Throws on failure rather than returning null: a swallowed error made a
   * failed page request indistinguishable from "this page has no rows", so
   * clicking Next appeared to do nothing at all.
   */
  async getLogs(options = {}) {
    if (!this.apiBaseUrl) this.init();

    const params = new URLSearchParams();
    if (options.user_id) params.append('user_id', options.user_id);
    if (options.action) params.append('action', options.action);
    if (options.status) params.append('status', options.status);
    if (options.start_date) params.append('start_date', options.start_date);
    if (options.end_date) params.append('end_date', options.end_date);
    if (options.limit != null) params.append('limit', options.limit);
    if (options.offset != null) params.append('offset', options.offset);

    const response = await fetch(
      `${this.apiBaseUrl}/api/audit-logs?${params.toString()}`,
      {
        headers: {
          'Authorization': this.getSessionToken() || '',
        },
      }
    );

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = typeof body?.detail === 'string' ? body.detail : '';
      } catch {
        // Non-JSON error body - the status code alone is enough context.
      }
      throw new Error(
        `Audit log request failed with status ${response.status}${detail ? `: ${detail}` : ''}`
      );
    }

    return response.json();
  }

  /**
   * Distinct action names actually present in the audit table, with counts.
   * Used to populate the action filter suggestions.
   */
  async getActions() {
    try {
      if (!this.apiBaseUrl) this.init();

      const response = await fetch(`${this.apiBaseUrl}/api/audit-logs/actions`, {
        headers: {
          'Authorization': this.getSessionToken() || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data?.actions) ? data.actions : [];
      }
    } catch (err) {
      console.error('[AuditLogger] Failed to fetch actions:', err);
    }
    return [];
  }
}

export const auditLogger = new AuditLogger();
