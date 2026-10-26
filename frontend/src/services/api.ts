const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, statusCode = 400, code = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('pm_auth_token');
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => null);

  if (response.status === 401) {
    localStorage.removeItem('pm_auth_token');
    localStorage.removeItem('pm_auth_user');
    if (data?.error?.code === 'SESSION_REVOKED') {
      sessionStorage.setItem(
        'pm_session_revoked_msg',
        'Your session was terminated because this account logged in from another device or location.'
      );
    }
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error?.message || data?.message || `Request failed with status ${response.status}`,
      response.status,
      data?.error?.code || 'API_ERROR'
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: any) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: any) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: any) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' })
};
