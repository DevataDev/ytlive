import { getToken, logout } from './auth';

export async function apiFetch(path: string, init: RequestInit = {}) {
  const base = process.env.NEXT_PUBLIC_OPS_API_URL ?? 'http://localhost:8080';
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(base + path, { ...init, headers, credentials: 'include' });
  if (res.status === 401) {
    logout();
  }
  return res;
}
