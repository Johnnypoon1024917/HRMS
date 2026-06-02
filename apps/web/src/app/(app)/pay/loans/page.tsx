'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { PayrollLoanView, StaffListItem } from '@hrms/contracts';
import { api } from '@/lib/api';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-HK', { style: 'currency', currency: 'HKD' }).format(n);

export default function LoansPage() {
  const [loans, setLoans] = useState<PayrollLoanView[]>([]);
  const [staff, setStaff] = useState<StaffListItem[]>([]);
  const [form, setForm] = useState({
    staffId: '', principal: 12000, interestRate: 0,
    installments: 12, startPeriod: '2026-06', reason: '',
  });
  const [selected, setSelected] = useState<PayrollLoanView | null>(null);
  const [err, setErr] = useState('');

  const load = () => api<PayrollLoanView[]>('/pay/loans').then(setLoans);
  useEffect(() => {
    load();
    api<{ items: StaffListItem[] }>('/pim/staff?page=1&pageSize=100')
      .then((r) => setStaff(r.items));
  }, []);

  const create = async () => {
    setErr('');
    try {
      await api('/pay/loans', { method: 'POST', body: JSON.stringify(form) });
      await load();
    } catch (e: any) { setErr(e.message); }
  };

  return (
    <Box sx={{ maxWidth: 1200 }}>
      <Typography variant="h4" mb={0.5}>Payroll loans</Typography>
      <Typography color="text.secondary" mb={3}>
        Salary advances and loans, amortized over the pay calendar. Installments
        are auto-deducted by the payroll engine each period.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField select size="small" label="Staff" value={form.staffId}
            onChange={(e) => setForm({ ...form, staffId: e.target.value })}
            sx={{ minWidth: 220 }}>
            {staff.map((s) => (
              <MenuItem key={s.id} value={s.id}>{s.staffNo} · {s.nameEn}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" type="number" label="Principal (HKD)"
            value={form.principal}
            onChange={(e) => setForm({ ...form, principal: Number(e.target.value) })}
            sx={{ width: 160 }} />
          <TextField size="small" type="number" label="Annual rate" inputProps={{ step: 0.001 }}
            value={form.interestRate}
            onChange={(e) => setForm({ ...form, interestRate: Number(e.target.value) })}
            sx={{ width: 140 }} />
          <TextField size="small" type="number" label="Installments"
            value={form.installments}
            onChange={(e) => setForm({ ...form, installments: Number(e.target.value) })}
            sx={{ width: 130 }} />
          <TextField size="small" label="Start period (YYYY-MM)"
            value={form.startPeriod}
            onChange={(e) => setForm({ ...form, startPeriod: e.target.value })}
            sx={{ width: 180 }} />
          <TextField size="small" label="Reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            sx={{ minWidth: 200, flexGrow: 1 }} />
          <Button variant="contained" onClick={create} disabled={!form.staffId}>
            Issue loan
          </Button>
        </Stack>
      </Paper>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Stack direction="row" spacing={2.5}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" mb={1}>Active &amp; historical</Typography>
          <Stack spacing={1}>
            {loans.map((l) => (
              <Paper key={l.id} variant="outlined" sx={{
                p: 1.5, display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer',
                bgcolor: selected?.id === l.id ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }} onClick={() => setSelected(l)}>
                <Typography sx={{ fontWeight: 500 }}>{l.staffId.slice(0, 10)}…</Typography>
                <Chip size="small" label={l.status} color={l.status === 'active' ? 'primary' : 'default'} />
                <Box flexGrow={1} />
                <Typography variant="body2" color="text.secondary">
                  {l.installments} × {fmt(l.installmentAmount)}
                </Typography>
                <Typography sx={{ fontWeight: 600, minWidth: 100, textAlign: 'right' }}>
                  {fmt(l.outstanding)} <Typography component="span" variant="caption" color="text.secondary"> outstanding</Typography>
                </Typography>
              </Paper>
            ))}
            {loans.length === 0 && (
              <Typography variant="body2" color="text.secondary">No loans on file.</Typography>
            )}
          </Stack>
        </Box>

        {selected && (
          <Paper variant="outlined" sx={{ p: 2, width: 360 }}>
            <Typography variant="subtitle1" mb={1.5}>Amortization schedule</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '40px 90px 1fr 1fr 80px',
              fontSize: 12, color: 'text.secondary', mb: 0.5, fontWeight: 500 }}>
              <Box>#</Box><Box>Period</Box><Box>Principal</Box><Box>Interest</Box><Box align-self="end">Status</Box>
            </Box>
            {selected.schedule.map((s) => (
              <Box key={s.sequence} sx={{
                display: 'grid', gridTemplateColumns: '40px 90px 1fr 1fr 80px',
                py: 0.5, fontSize: 13, alignItems: 'center',
                color: s.status === 'deducted' ? 'text.secondary' : undefined,
              }}>
                <Box>{s.sequence}</Box>
                <Box>{s.period}</Box>
                <Box>{fmt(s.principalPart)}</Box>
                <Box>{fmt(s.interestPart)}</Box>
                <Box>
                  <Chip size="small"
                    label={s.status}
                    color={s.status === 'deducted' ? 'success' : 'default'}
                    sx={{ height: 18, fontSize: 10 }}
                  />
                </Box>
              </Box>
            ))}
          </Paper>
        )}
      </Stack>
    </Box>
  );
}
