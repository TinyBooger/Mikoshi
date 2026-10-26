// Shared HTTP helpers for the browse data layer.
export function apiUrl(path) {
  const base = window.API_BASE_URL || '';
  return path.startsWith('http') ? path : `${base}${path}`;
}

export function authHeaders(token, extra = {}) {
  return token ? { ...extra, Authorization: token } : extra;
}

export async function fetchJson(path, { token, signal, ...init } = {}) {
  const response = await fetch(apiUrl(path), {
    ...init,
    signal,
    headers: authHeaders(token, init.headers),
  });
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.detail || '';
    } catch {
      // non-JSON error body
    }
    const error = new Error(detail || `Request failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export function buildQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  return search.toString();
}
