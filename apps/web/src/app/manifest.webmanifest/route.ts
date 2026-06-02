import { NextRequest, NextResponse } from 'next/server';

/**
 * Per-tenant PWA manifest. The installed app is branded per tenant (name,
 * theme colour, icon) using the unauthenticated public-branding endpoint —
 * same white-label config that themes the web UI.
 */
export async function GET(req: NextRequest) {
  const api = process.env.API_URL ?? 'http://localhost:4000';
  const tenant =
    req.nextUrl.hostname.split('.')[0] ||
    process.env.NEXT_PUBLIC_TENANT ||
    'acme';

  let b: any = {};
  try {
    const r = await fetch(`${api}/api/config/public-branding`, {
      headers: { 'X-Tenant': tenant },
      cache: 'no-store',
    });
    if (r.ok) b = await r.json();
  } catch {
    /* fall back to defaults below */
  }

  return NextResponse.json({
    name: b.appName ?? 'People HRMS',
    short_name: b.appName ?? 'HRMS',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f9fa',
    theme_color: b?.colorTone?.primary ?? '#1a73e8',
    icons: [
      { src: b.faviconUrl ?? '/brand/default/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/default/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  });
}
