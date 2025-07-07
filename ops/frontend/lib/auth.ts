const KEY = 'ops_jwt';

export function saveToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEY, token);
    // also set cookie so that server components can access it
    document.cookie = `${KEY}=${token}; path=/`;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

export async function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(KEY);
    // expire cookie
    document.cookie = `${KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    // try backend logout to clear cookie
    try {
      const base = (process.env.NEXT_PUBLIC_OPS_BACKEND_URL ?? process.env.NEXT_PUBLIC_OPS_API_URL) ?? 'http://localhost:8080';
      await fetch(base + '/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (_) { /* ignore */ }
    window.location.href = '/login';
  }
}
