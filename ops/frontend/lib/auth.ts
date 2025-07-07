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

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(KEY);
    // expire cookie
    document.cookie = `${KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    window.location.href = '/login';
  }
}
