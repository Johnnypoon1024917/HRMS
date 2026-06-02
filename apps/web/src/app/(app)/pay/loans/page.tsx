'use client';

import { useEffect, useState } from 'react';
import { Box, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import type { PayrollLoanView } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { StaffPicker } from '@/components/inputs/StaffPicker';
import { useNotify } from '@/components/feedback/Notify';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-HK', { style: 'currency', currency: 'HKD' }).format(n);

const emptyForm = {
  staffId: '', principal: 12000, interestRate: 0,
  installments: 12, startPeriod: '2026-06', reason: '',
};

export default function LoansPage() {
  const notify = useNotify();
  const [loans, setLoans] = useState<PayrollLoanView[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState<PayrollLoanView | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoans(await api<PayrollLoanView[]>('/pay/loans'));
    } catch (e: any) {
      notify.error(e.message);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDrawer = () => { setForm(emptyForm); setOpen(true); };

  const create = async () => {
    setSaving(true);
    try {
      await api('/pay/loans', { method: 'POST', body: JSON.stringify(form) });
      notify.success('Loan issued');
      setOpen(false);
      await load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200 }}>
      <PageHeader
        title="Payroll loans"
        subtitle="Salary advances and loans, amortized over the pay calendar. Installments are auto-deducted by the payroll engine each period."
        primary={{ label: 'Issue loan', icon: 'add', onClick: openDrawer }}
      />

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

      <CrudDrawer
        open={open}
        title="Issue loan"
        subtitle="Create a salary advance amortized over the pay calendar."
        onClose={() => setOpen(false)}
        onSubmit={create}
        submitLabel="Issue loan"
        submitting={saving}
        submitDisabled={!form.staffId}
      >
        <StaffPicker
          value={form.staffId || null}
          onChange={(id) => setForm({ ...form, staffId: id ?? '' })}
          required
        />
        <TextField type="number" label="Principal (HKD)"
          value={form.principal}
          onChange={(e) => setForm({ ...form, principal: Number(e.target.value) })} />
        <TextField type="number" label="Annual rate" inputProps={{ step: 0.001 }}
          value={form.interestRate}
          onChange={(e) => setForm({ ...form, interestRate: Number(e.target.value) })} />
        <TextField type="number" label="Installments"
          value={form.installments}
          onChange={(e) => setForm({ ...form, installments: Number(e.target.value) })} />
        <TextField label="Start period (YYYY-MM)"
          value={form.startPeriod}
          onChange={(e) => setForm({ ...form, startPeriod: e.target.value })} />
        <TextField label="Reason"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </CrudDrawer>
    </Box>
  );
}
