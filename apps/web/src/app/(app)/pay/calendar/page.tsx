'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { PayCalendarEntry } from '@hrms/contracts';
import { api } from '@/lib/api';

const statusColor = (s: string) =>
  s === 'paid' ? 'success' : s === 'locked' ? 'warning' : 'default';

export default function PayCalendarPage() {
  const [groups, setGroups] = useState<{ code: string; name: string }[]>([]);
  const [group, setGroup] = useState('MONTHLY-HK');
  const [rows, setRows] = useState<PayCalendarEntry[]>([]);
  const [from, setFrom] = useState('2026-01');
  const [to, setTo] = useState('2026-12');

  useEffect(() => {
    api<any[]>('/pay/groups').then((g) =>
      setGroups(g.map((x) => ({ code: x.code, name: x.name }))),
    );
  }, []);
  useEffect(() => {
    api<PayCalendarEntry[]>(`/pay/calendar/${group}`).then(setRows);
  }, [group]);

  const generate = async () => {
    await api('/pay/calendar/generate', {
      method: 'POST',
      body: JSON.stringify({ groupCode: group, fromPeriod: from, toPeriod: to }),
    });
    setRows(await api<PayCalendarEntry[]>(`/pay/calendar/${group}`));
  };

  return (
    <Box sx={{ maxWidth: 1100 }}>
      <Typography variant="h4" mb={0.5}>Payroll calendar</Typography>
      <Typography color="text.secondary" mb={3}>
        Cutoff and payment dates per pay group.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <TextField select size="small" label="Pay group" value={group}
            onChange={(e) => setGroup(e.target.value)} sx={{ minWidth: 240 }}>
            {groups.map((g) => (
              <MenuItem key={g.code} value={g.code}>{g.name}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="From (YYYY-MM)" value={from}
            onChange={(e) => setFrom(e.target.value)} sx={{ width: 160 }} />
          <TextField size="small" label="To (YYYY-MM)" value={to}
            onChange={(e) => setTo(e.target.value)} sx={{ width: 160 }} />
          <Button variant="contained" onClick={generate}>Generate</Button>
        </Stack>
      </Paper>

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
    </Box>
  );
}
