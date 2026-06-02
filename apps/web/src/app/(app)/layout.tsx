'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { getToken } from '@/lib/api';

/** Authenticated area: redirects to /login when no token is present. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);
  return <AppShell>{children}</AppShell>;
}
