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
import type { PublicHolidayView } from '@hrms/contracts';
import { api } from '@/lib/api';
import { Sym } from '@/components/Sym';

const TYPE_COLOR = (t: string) =>
  t === 'statutory' ? 'success' : t === 'company' ? 'info' : 'default';

export default function HolidaysPage() {
  const [locale, setLocale] = useState('HK');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-12-31');
  const [rows, setRows] = useState<PublicHolidayView[]>([]);
  const [sync, setSync] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    api<PublicHolidayView[]>(`/pay/holidays?localeCode=${locale}&from=${from}&to=${to}`).then(setRows);
    api<any>(`/pay/holidays/sync-status?localeCode=${locale}`).then(setSync);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [locale]);

  const doSync = async () => {
    setErr(''); setMsg('');
    try {
      const r = await api<any>('/pay/holidays/sync', {
        method: 'POST',
        body: JSON.stringify({ localeCode: locale }),
      });
      setMsg(
        r.status === 'ok'
          ? `Synced ${r.upserts} holidays from ${r.sourceUrl}`
          : `Sync fell back (${r.errorMessage}); ${r.upserts} holidays loaded from built-in list.`,
      );
      load();
    } catch (e: any) { setErr(e.message); }
  };

  const statutoryCount = rows.filter((r) => r.type === 'statutory').length;
  const generalCount = rows.filter((r) => r.type === 'general').length;

  return (
    <Box sx={{ maxWidth: 1100 }}>
      <Typography variant="h4" mb={0.5}>Public holidays</Typography>
      <Typography color="text.secondary" mb={3}>
        Synced from <b>data.gov.hk</b> (1823 calendar). Statutory holidays (12)
        are paid for non-monthly contracts under the Employment Ordinance.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <TextField select size="small" label="Locale" value={locale}
            onChange={(e) => setLocale(e.target.value)} sx={{ minWidth: 120 }}>
            <MenuItem value="HK">Hong Kong</MenuItem>
            <MenuItem value="SG">Singapore</MenuItem>
            <MenuItem value="UK">United Kingdom</MenuItem>
          </TextField>
          <TextField size="small" type="date" label="From" value={from}
            InputLabelProps={{ shrink: true }}
            onChange={(e) => setFrom(e.target.value)} />
          <TextField size="small" type="date" label="To" value={to}
            InputLabelProps={{ shrink: true }}
            onChange={(e) => setTo(e.target.value)} />
          <Button variant="outlined" onClick={load}>Filter</Button>
          <Box flexGrow={1} />
          <Button variant="contained" startIcon={<Sym name="sync" size={18} />} onClick={doSync}>
            Sync from data.gov.hk
          </Button>
        </Stack>
        {sync && (
          <Typography variant="caption" color="text.secondary" mt={1.5} display="block">
            Last sync:{' '}
            {sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleString() : '—'}
            {' · '}{sync.itemCount} holiday{sync.itemCount === 1 ? '' : 's'}{' · '}
            <Chip size="small" label={sync.status} color={sync.status === 'ok' ? 'success' : 'error'} sx={{ height: 18, fontSize: 10 }} />
            {sync.errorMessage && ` · ${sync.errorMessage}`}
          </Typography>
        )}
      </Paper>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      <Stack direction="row" spacing={2} mb={2}>
        <Chip label={`${statutoryCount} statutory`} color="success" size="small" />
        <Chip label={`${generalCount} general`} size="small" />
      </Stack>

      <Paper variant="outlined">
        <Box sx={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 100px 120px',
                   px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider',
                   color: 'text.secondary', fontSize: 13, fontWeight: 500 }}>
          <Box>Date</Box>
          <Box>Name (EN)</Box>
          <Box>名稱</Box>
          <Box>Type</Box>
          <Box>Source</Box>
        </Box>
        {rows.map((r) => (
          <Box key={r.id} sx={{
            display: 'grid', gridTemplateColumns: '130px 1fr 1fr 100px 120px',
            px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider', alignItems: 'center',
            '&:hover': { bgcolor: 'action.hover' },
          }}>
            <Box sx={{ fontWeight: 500 }}>
              {new Date(r.date).toLocaleDateString('en-HK', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })}
            </Box>
            <Box>{r.nameEn}</Box>
            <Box sx={{ color: 'text.secondary' }}>{r.nameZh ?? '—'}</Box>
            <Box>
              <Chip size="small" label={r.type} color={TYPE_COLOR(r.type) as any} />
            </Box>
            <Box sx={{ fontSize: 12, color: 'text.secondary' }}>
              {r.source.startsWith('http') ? 'data.gov.hk' : r.source}
            </Box>
          </Box>
        ))}
        {rows.length === 0 && (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            No holidays loaded — click <b>Sync from data.gov.hk</b> above.
          </Box>
        )}
      </Paper>
    </Box>
  );
}
