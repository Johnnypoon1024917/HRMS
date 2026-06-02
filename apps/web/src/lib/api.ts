'use client';

const TOKEN_KEY = 'hrms_token';

export function getToken() {
  return typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Thin fetch wrapper. Tenant is resolved server-side from the host; in dev
 *  we pass it via the X-Tenant header (default "acme"). */
export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant': process.env.NEXT_PUBLIC_TENANT ?? 'acme',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  // 402 = tenant suspended (non-payment). Redirect to the upgrade page once.
  if (res.status === 402 && typeof window !== 'undefined' && window.location.pathname !== '/suspended') {
    window.location.href = '/suspended';
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? res.statusText);
  return res.status === 204 ? (undefined as T) : res.json();
}
