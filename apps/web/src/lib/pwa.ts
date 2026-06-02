'use client';

/** Registers the service worker (installable PWA + offline shell + push). */
export function registerPwa() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* PWA is progressive enhancement; ignore registration failure */
    });
  });
}
