/**
 * Frontend Error Logger
 * Captures and logs errors from the client-side application
 */

export class ErrorLogger {
  constructor() {
    console.log('[ErrorLogger] Constructor called');
    this.apiBaseUrl = null;
    this.isInitialized = false;
  }

  /**
   * Initialize error logging with global handlers
   */
  init() {
    if (this.isInitialized) return;

    // Resolve API base URL after globals are set
    this.apiBaseUrl = window.API_BASE_URL;

    // Log unhandled errors
    window.addEventListener('error', (event) => {
      this.captureError({
        message: event.message,
        error_type: event.error?.name || 'ErrorEvent',
        severity: 'error',
        stack_trace: event.error?.stack,
        url: window.location.href,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    // Log unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      const message = error?.message || String(error) || 'Unhandled promise rejection';
      const stack = error?.stack || '';

      this.captureError({
        message,
        error_type: 'UnhandledPromiseRejection',
        severity: 'error',
        stack_trace: stack,
        url: window.location.href,
        context: {
          reason: String(event.reason),
        },
      });
    });

    // Log console errors
    const originalError = console.error;
    console.error = (...args) => {
      originalError.apply(console, args);

      // Only log if it looks like an actual error, not just debugging info
      const firstArg = args[0];
      if (
        firstArg instanceof Error ||
        (typeof firstArg === 'string' && 
         (firstArg.toLowerCase().includes('error') || 
          firstArg.toLowerCase().includes('failed')))
      ) {
        this.captureError({
          message: firstArg?.message || String(firstArg),
          error_type: firstArg?.name || 'ConsoleError',
          severity: 'warning',
          stack_trace: firstArg?.stack,
          url: window.location.href,
        });
      }
    };

    this.isInitialized = true;
    console.log('[ErrorLogger] Initialized with global error handlers');
  }

  /**
   * Capture an error and send to backend
   */
  async captureError({
    message,
    error_type = 'Unknown',
    severity = 'error',
    stack_trace = null,
    url = window.location.href,
    context = null,
  }) {
    const errorData = {
      message,
      error_type,
      severity,
      url,
      user_agent: navigator.userAgent,
      stack_trace,
      context,
    };

    // Log to browser console in development
    if (import.meta?.env?.DEV) {
      console.log('[ErrorLogger]', errorData);
    }

    // Send to backend
    await this.sendToBackend(errorData);
  }

  /**
   * Manually log an error (useful for try-catch blocks)
   */
  async logError(error, customMessage = null, severity = 'error') {
    const message = customMessage || error?.message || String(error);
    const stack = error?.stack;
    const errorType = error?.name || 'Error';

    await this.captureError({
      message,
      error_type: errorType,
      severity,
      stack_trace: stack,
      url: window.location.href,
    });
  }

  /**
   * Log a custom error event
   */
  async logCustomError(message, severity = 'error', context = null) {
    await this.captureError({
      message,
      error_type: 'CustomError',
      severity,
      url: window.location.href,
      context,
    });
  }

  /**
   * Send error to backend API
   */
  async sendToBackend(errorData) {
    try {
      if (!this.apiBaseUrl) {
        console.warn('[ErrorLogger] API base URL not set; skipping send.');
        return;
      }
      const response = await fetch(
        `${this.apiBaseUrl}/api/error-logs/frontend`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.getSessionToken() || '',
          },
          body: JSON.stringify(errorData),
        }
      );

      if (!response.ok) {
        console.warn('[ErrorLogger] Failed to send error to backend', response.status);
      }
    } catch (err) {
      // Silently fail - don't want error logging to break the app
      console.warn('[ErrorLogger] Could not reach error log endpoint:', err);
    }
  }

  /**
   * Get current session token from localStorage
   */
  getSessionToken() {
    try {
      return localStorage.getItem('sessionToken');
    } catch {
      return null;
    }
  }

  /**
   * Get error logger statistics from backend (admin only)
   */
  async getStats(hours = 24) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/error-logs/stats?hours=${hours}`,
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
      console.error('[ErrorLogger] Failed to fetch stats:', err);
    }
    return null;
  }

  /**
   * Get error logs from backend (admin only)
   */
  async getLogs(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.severity) params.append('severity', options.severity);
      if (options.source) params.append('source', options.source);
      if (options.error_type) params.append('error_type', options.error_type);
      if (options.resolved !== undefined) params.append('resolved', options.resolved);
      if (options.limit) params.append('limit', options.limit);
      if (options.offset) params.append('offset', options.offset);

      const response = await fetch(
        `${this.apiBaseUrl}/api/error-logs?${params.toString()}`,
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
      console.error('[ErrorLogger] Failed to fetch logs:', err);
    }
    return null;
  }

  /**
   * Get error log summary (admin only)
   */
  async getSummary() {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/error-logs/summary`,
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
      console.error('[ErrorLogger] Failed to fetch summary:', err);
    }
    return null;
  }

  /**
   * Resolve an error log (admin only)
   */
  async resolveError(errorId, resolved = true) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/error-logs/${errorId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.getSessionToken() || '',
          },
          body: JSON.stringify({ resolved }),
        }
      );

      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error('[ErrorLogger] Failed to resolve error:', err);
    }
    return null;
  }

  /**
   * Delete an error log (admin only)
   */
  async deleteError(errorId) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/error-logs/${errorId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': this.getSessionToken() || '',
          },
        }
      );

      return response.ok;
    } catch (err) {
      console.error('[ErrorLogger] Failed to delete error:', err);
    }
    return false;
  }

  /**
   * Delete old error logs (admin only)
   */
  async deleteOldLogs(days = 30) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/error-logs?days=${days}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': this.getSessionToken() || '',
          },
        }
      );

      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error('[ErrorLogger] Failed to delete old logs:', err);
    }
    return null;
  }
}

// Create a singleton instance
export const errorLogger = new ErrorLogger();
