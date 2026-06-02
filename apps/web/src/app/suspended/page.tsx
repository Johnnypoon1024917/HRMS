'use client';

import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { Sym } from '@/components/Sym';

/** Shown when the API returns 402 TENANT_SUSPENDED. */
export default function SuspendedPage() {
  const router = useRouter();
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
      <Card sx={{ maxWidth: 460 }}>
        <CardContent sx={{ textAlign: 'center', py: 5 }}>
          <Sym name="lock" size={48} />
          <Typography variant="h5" fontWeight={600} mt={1}>
            Workspace suspended
          </Typography>
          <Typography color="text.secondary" mt={1} mb={3}>
            Your subscription is past due or cancelled. Re-activate billing to
            restore access. Your data is safe.
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="center">
            <Button variant="contained" onClick={() => router.push('/admin/subscription')}>
              Manage subscription
            </Button>
            <Button onClick={() => router.push('/login')}>Sign in</Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
