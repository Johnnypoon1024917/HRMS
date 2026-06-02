'use client';

import { Suspense, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, setToken } from '@/lib/api';
import { useBoot } from '@/theme/AppProviders';

function LoginInner() {
  const router = useRouter();
  const { branding, refresh } = useBoot();
  const [email, setEmail] = useState('admin@acme.test');
  const [password, setPassword] = useState('Passw0rd!');
  const [err, setErr] = useState('');
  const params = useSearchParams();
  const ssoFailed = params.get('sso') === 'failed';

  const tenant = process.env.NEXT_PUBLIC_TENANT ?? 'acme';
  const ssoLogin = () => {
    window.location.href = `/api/auth/oidc/login?tenant=${tenant}`;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      const r = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(r.accessToken);
      refresh();
      router.push('/dashboard');
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        background: branding.loginBackgroundUrl
          ? `url(${branding.loginBackgroundUrl}) center/cover`
          : (t) => t.palette.background.default,
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          width: 448,
          maxWidth: '100%',
          p: { xs: 4, sm: 6 },
          borderRadius: 4,
        }}
      >
        <Box component="form" onSubmit={submit}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={branding.logoUrl}
              alt=""
              height={36}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </Box>
          <Typography
            variant="h5"
            textAlign="center"
            sx={{ fontWeight: 400, fontSize: 26, mb: 0.5 }}
          >
            Sign in
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            textAlign="center"
            mb={4}
          >
            Continue to {branding.appName}
          </Typography>

          {(err || ssoFailed) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {err || 'SSO sign-in failed. Try again or use a password.'}
            </Alert>
          )}

          <Button
            variant="outlined"
            fullWidth
            onClick={ssoLogin}
            sx={{ mb: 2.5, py: 1.25 }}
          >
            Continue with SSO
          </Button>

          <Divider sx={{ mb: 2.5, color: 'text.secondary', fontSize: 12 }}>or</Divider>

          <TextField
            fullWidth
            label="Email"
            margin="dense"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            size="medium"
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            margin="dense"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            size="medium"
            sx={{ mb: 3 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" sx={{ minWidth: 110 }}>
              Sign in
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
