'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import type { PlanView, SubscriptionView } from '@hrms/contracts';
import { api } from '@/lib/api';

const colorByStatus = (s: string) =>
  s === 'active' ? 'success' :
  s === 'trialing' ? 'info' :
  s === 'past_due' ? 'warning' :
  s === 'canceled' || s === 'unpaid' ? 'error' : 'default';

/** Tenant-admin subscription self-service: pick a plan, launch checkout,
 *  open the hosted billing portal. */
export default function SubscriptionPage() {
  const [sub, setSub] = useState<SubscriptionView | null>(null);
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [err, setErr] = useState('');

  const load = async () => {
    setSub(await api<SubscriptionView>('/bil/subscription'));
    setPlans(await api<PlanView[]>('/bil/plans'));
  };
  useEffect(() => { load(); }, []);

  const checkout = async (planCode: string) => {
    setErr('');
    try {
      const origin = window.location.origin;
      const r = await api<{ url: string }>('/bil/checkout', {
        method: 'POST',
        body: JSON.stringify({
          planCode,
          successUrl: `${origin}/admin/subscription?ok=1`,
          cancelUrl: `${origin}/admin/subscription?cancel=1`,
        }),
      });
      window.location.href = r.url;
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const portal = async () => {
    setErr('');
    try {
      const r = await api<{ url: string }>('/bil/portal', {
        method: 'POST',
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      window.location.href = r.url;
    } catch (e: any) {
      setErr(e.message);
    }
  };

  if (!sub) return null;
  const seatPct = sub.maxSeats ? (sub.activeStaff / sub.maxSeats) * 100 : 0;

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Subscription
      </Typography>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={3} alignItems="center" mb={2} flexWrap="wrap">
            <Box>
              <Typography color="text.secondary" variant="body2">Plan</Typography>
              <Typography variant="h6" fontWeight={600}>
                {sub.planName ?? '— none —'}
              </Typography>
            </Box>
            <Chip label={sub.status} color={colorByStatus(sub.status) as any} />
            {sub.currentPeriodEnd && (
              <Typography variant="body2" color="text.secondary">
                Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
              </Typography>
            )}
            {sub.trialEndsAt && (
              <Typography variant="body2" color="text.secondary">
                Trial ends {new Date(sub.trialEndsAt).toLocaleDateString()}
              </Typography>
            )}
            <Box flexGrow={1} />
            {sub.status !== 'none' && (
              <Button variant="outlined" onClick={portal}>
                Manage billing
              </Button>
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" mb={0.5}>
            Seats: {sub.activeStaff}{sub.maxSeats ? ` / ${sub.maxSeats}` : ' (unlimited)'}
          </Typography>
          {sub.maxSeats > 0 && (
            <LinearProgress
              variant="determinate"
              value={Math.min(100, seatPct)}
              color={seatPct >= 100 ? 'error' : seatPct >= 80 ? 'warning' : 'primary'}
            />
          )}
        </CardContent>
      </Card>

      <Typography fontWeight={600} mb={1}>Available plans</Typography>
      <Grid container spacing={2}>
        {plans.map((p) => (
          <Grid key={p.code} item xs={12} sm={6} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" fontWeight={600}>{p.name}</Typography>
                <Typography color="text.secondary" mb={1}>
                  {(p.monthlyPrice / 100).toFixed(2)} {p.currency} / month
                </Typography>
                <Typography variant="body2" mb={2}>
                  Seats: {p.maxSeats || 'unlimited'} · Modules: {p.includedModules.length}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={2}>
                  {p.includedModules.map((m) => (
                    <Chip key={m} size="small" label={m} />
                  ))}
                </Stack>
                <Button
                  variant={sub.planCode === p.code ? 'outlined' : 'contained'}
                  fullWidth disabled={sub.planCode === p.code && sub.status === 'active'}
                  onClick={() => checkout(p.code)}
                >
                  {sub.planCode === p.code ? 'Current plan' : 'Choose'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
