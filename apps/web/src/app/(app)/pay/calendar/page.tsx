'use client';

import { useEffect, useState } from 'react';
import { Box, Chip, MenuItem, Paper, TextField } from '@mui/material';
import type { PayCalendarEntry } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';

const statusColor = (s: string) =>
  s === 'paid' ? 'success' : s === 'locked' ? 'warning' : 'default';

export default function PayCalendarPage() {
  const notify = useNotify();
  const [groups, setGroups] = useState<{ code: string; name: string }[]>([]);
  const [group, setGroup] = useState('MONTHLY-HK');
  const [rows, setRows] = useState<PayCalendarEntry[]>([]);
  const [from, setFrom] = useState('2026-01');
  const [to, setTo] = useState('2026-12');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<any[]>('/pay/groups')
      .then((g) => setGroups(g.map((x) => ({ code: x.code, name: x.name }))))
      .catch((e: any) => notify.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api<PayCalendarEntry[]>(`/pay/calendar/${group}`)
      .then(setRows)
      .catch((e: any) => notify.error(e.message));
  }, [group]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async () => {
    setSaving(true);
    try {
      await api('/pay/calendar/generate', {
        method: 'POST',
        body: JSON.stringify({ groupCode: group, fromPeriod: from, toPeriod: to }),
      });
      setRows(await api<PayCalendarEntry[]>(`/pay/calendar/${group}`));
      notify.success('Calendar generated');
      setOpen(false);
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1100 }}>
      <PageHeader
        title="Payroll calendar"
        subtitle="Cutoff and payment dates per pay group."
        primary={{ label: 'Generate', icon: 'add', onClick: () => setOpen(true) }}
      />

      <Paper variant="outlined">
        <Box sx={{ display: 'grid', gridTemplateColumns: '110px 160px 160px 160px 100px', px: 2, py: 1.5,
                   borderBottom: 1, borderColor: 'divider', color: 'text.secondary', fontSize: 13, fontWeight: 500 }}>
          <Box>Period</Box>
          <Box>Window</Box>
          <Box>Cutoff</Box>
          <Box>Payment date</Box>
          <Box>Status</Box>
        </Box>
        {rows.map((r) => (
          <Box key={r.id}
            sx={{ display: 'grid', gridTemplateColumns: '110px 160px 160px 160px 100px',
                  px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', alignItems: 'center',
                  '&:hover': { bgcolor: 'action.hover' } }}>
            <Box sx={{ fontWeight: 500 }}>{r.period}</Box>
            <Box sx={{ fontSize: 13, color: 'text.secondary' }}>
              {new Date(r.periodStart).toLocaleDateString()} –{' '}
              {new Date(r.periodEnd).toLocaleDateString()}
            </Box>
            <Box sx={{ fontSize: 13 }}>{new Date(r.cutoffAt).toLocaleDateString()}</Box>
            <Box sx={{ fontSize: 13, fontWeight: 500 }}>
              {new Date(r.paymentDate).toLocaleDateString()}
            </Box>
            <Box>
              <Chip size="small" label={r.status} color={statusColor(r.status) as any} />
            </Box>
          </Box>
        ))}
        {rows.length === 0 && (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            No calendar yet — set a range above and click Generate.
          </Box>
        )}
      </Paper>

      <CrudDrawer
        open={open}
        title="Generate calendar"
        subtitle="Generate cutoff and payment dates for a pay group."
        onClose={() => setOpen(false)}
        onSubmit={generate}
        submitLabel="Generate"
        submitting={saving}
        submitDisabled={!group || !from || !to}
      >
        <TextField select label="Pay group" value={group}
          onChange={(e) => setGroup(e.target.value)}>
          {groups.map((g) => (
            <MenuItem key={g.code} value={g.code}>{g.name}</MenuItem>
          ))}
        </TextField>
        <TextField label="From (YYYY-MM)" value={from}
          onChange={(e) => setFrom(e.target.value)} />
        <TextField label="To (YYYY-MM)" value={to}
          onChange={(e) => setTo(e.target.value)} />
      </CrudDrawer>
    </Box>
  );
}
