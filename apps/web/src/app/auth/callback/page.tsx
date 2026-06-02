'use client';

import { useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/api';
import { useBoot } from '@/theme/AppProviders';

/** SSO landing: the API redirected here with #token=<jwt>. Store it and go. */
export default function SsoCallback() {
  const router = useRouter();
  const { refresh } = useBoot();

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('token');
    if (token) {
      setToken(token);
      refresh();
      router.replace('/dashboard');
    } else {
      router.replace('/login?sso=failed');
    }
  }, [router, refresh]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <Box textAlign="center">
        <CircularProgress />
        <Typography mt={2}>Completing sign-in…</Typography>
      </Box>
    </Box>
  );
}
