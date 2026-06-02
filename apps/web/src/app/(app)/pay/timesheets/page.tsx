'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { StaffListItem, TimesheetView } from '@hrms/contracts';
import { api } from '@/lib/api';
import { Sym } from '@/components/Sym';

const KIND_OPTIONS = [
  { value: 'regular',         label: 'Regular' },
  { value: 'ot15',            label: 'OT (1.5×)' },
  { value: 'ot20',            label: 'OT (2.0×)' },
  { value: 'rest_day_work',   label: 'Rest day work' },
  { value: 'holiday_work',    label: 'Holiday work' },
];

const STATUS_COLOR = (s: string) =>
  s === 'approved' ? 'success' : s === 'submitted' ? 'info' : 'default';

interface EntryDraft { date: string; hours: number; kind: string; note?: string }

export default function TimesheetsPage() {
  const [staff, setStaff] = useState<StaffListItem[]>([]);
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const [staffId, setStaffId] = useState('');
  const [entries, setEntries] = useState<EntryDraft[]>([]);
  const [list, setList] = useState<TimesheetView[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: StaffListItem[] }>('/pim/staff?page=1&pageSize=100').then((r) =>
      setStaff(r.items),
    );
  }, []);

  const loadList = () =>
    api<TimesheetView[]>(`/pay/timesheets${staffId ? `?staffId=${staffId}` : ''}`).then(setList);
  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, [staffId]);

  const addEntry = () =>
    setEntries((e) => [...e, { date: `${period}-15`, hours: 8, kind: 'regular' }]);
  const updateEntry = (i: number, patch: Partial<EntryDraft>) =>
    setEntries((e) => e.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeEntry = (i: number) =>
    setEntries((e) => e.filter((_, idx) => idx !== i));

  const save = async () => {
    setErr(''); setMsg('');
    try {
      await api('/pay/timesheets', {
        method: 'PUT',
        body: JSON.stringify({ staffId, period, entries }),
      });
      setMsg('Timesheet saved as draft.');
      loadList();
    } catch (e: any) { setErr(e.message); }
  };

  const submit = async (id: string) => {
    await api(`/pay/timesheets/${id}/submit`, { method: 'POST' });
    loadList();
  };
  const approve = async (id: string) => {
    await api(`/pay/timesheets/${id}/approve`, { method: 'POST' });
    loadList();
  };

  const totals = entries.reduce(
    (a, e) => {
      a.total += e.hours;
      if (e.kind === 'regular') a.regular += e.hours;
      else if (e.kind === 'ot15') a.ot15 += e.hours;
      else a.ot20 += e.hours;
      return a;
    },
    { total: 0, regular: 0, ot15: 0, ot20: 0 },
  );

  return (
    <Box sx={{ maxWidth: 1300 }}>
      <Typography variant="h4" mb={0.5}>Timesheets</Typography>
      <Typography color="text.secondary" mb={3}>
        Hours for hourly / daily / OT-eligible staff. Approved timesheets feed
        the payroll engine for the matching period.
      </Typography>

      {/* Edit area */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} mb={entries.length ? 2.5 : 0}>
          <TextField select size="small" label="Staff" value={staffId}
            onChange={(e) => setStaffId(e.target.value)} sx={{ minWidth: 240 }}>
            {staff.map((s) => (
              <MenuItem key={s.id} value={s.id}>{s.staffNo} · {s.nameEn}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Period (YYYY-MM)" value={period}
            onChange={(e) => setPeriod(e.target.value)} sx={{ width: 170 }} />
          <Button variant="outlined" startIcon={<Sym name="add" size={18} />} onClick={addEntry} disabled={!staffId}>
            Add entry
          </Button>
          <Box flexGrow={1} />
          <Stack direction="row" spacing={2}>
            <Chip size="small" label={`${totals.regular.toFixed(1)} reg`} />
            <Chip size="small" label={`${totals.ot15.toFixed(1)} OT 1.5×`} />
            <Chip size="small" label={`${totals.ot20.toFixed(1)} OT 2.0×`} />
            <Chip size="small" label={`${totals.total.toFixed(1)} total`} color="primary" />
          </Stack>
          {entries.length > 0 && (
            <Button variant="contained" onClick={save}>Save draft</Button>
          )}
        </Stack>

        {entries.length > 0 && (
          <Box>
            {entries.map((e, i) => (
              <Stack key={i} direction="row" spacing={1.5} alignItems="center" mb={1}>
                <TextField size="small" type="date" value={e.date}
                  onChange={(ev) => updateEntry(i, { date: ev.target.value })}
                  sx={{ width: 160 }} InputLabelProps={{ shrink: true }} />
                <TextField size="small" type="number" label="Hours"
                  inputProps={{ step: 0.5, min: 0 }}
                  value={e.hours}
                  onChange={(ev) => updateEntry(i, { hours: Number(ev.target.value) })}
                  sx={{ width: 110 }} />
                <TextField select size="small" label="Kind" value={e.kind}
                  onChange={(ev) => updateEntry(i, { kind: ev.target.value })}
                  sx={{ width: 170 }}>
                  {KIND_OPTIONS.map((k) => (
                    <MenuItem key={k.value} value={k.value}>{k.label}</MenuItem>
                  ))}
                </TextField>
                <TextField size="small" label="Note" value={e.note ?? ''}
                  onChange={(ev) => updateEntry(i, { note: ev.target.value })}
                  sx={{ flexGrow: 1 }} />
                <IconButton size="small" onClick={() => removeEntry(i)}>
                  <Sym name="close" size={18} />
                </IconButton>
              </Stack>
            ))}
          </Box>
        )}
      </Paper>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      <Typography variant="subtitle1" mb={1.5}>Submitted timesheets</Typography>
      <Stack spacing={1}>
        {list.map((t) => (
          <Paper key={t.id} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography sx={{ fontWeight: 500, width: 90 }}>{t.period}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ width: 110 }}>
                {t.staffId.slice(0, 12)}…
              </Typography>
              <Chip size="small" label={t.status} color={STATUS_COLOR(t.status) as any} />
              <Box flexGrow={1} />
              <Typography variant="body2" color="text.secondary">
                {t.regularHours.toFixed(1)} reg · {t.ot15Hours.toFixed(1)} OT 1.5× · {t.ot20Hours.toFixed(1)} OT 2.0×
              </Typography>
              <Typography sx={{ fontWeight: 600 }}>{t.totalHours.toFixed(1)}h</Typography>
              {t.status === 'draft' && (
                <Button size="small" variant="outlined" onClick={() => submit(t.id)}>Submit</Button>
              )}
              {t.status === 'submitted' && (
                <Button size="small" variant="contained" onClick={() => approve(t.id)}>Approve</Button>
              )}
              <IconButton size="small" onClick={() => setEditing(editing === t.id ? null : t.id)}>
                <Sym name={editing === t.id ? 'expand_less' : 'expand_more'} size={20} />
              </IconButton>
            </Stack>
            {editing === t.id && (
              <Box mt={2} pl={2} borderLeft={2} borderColor="divider">
                {t.entries.map((e) => (
                  <Stack key={e.id} direction="row" spacing={2} alignItems="center" sx={{ py: 0.5 }}>
                    <Typography variant="body2" sx={{ width: 110, fontFamily: 'monospace' }}>
                      {e.date}
                    </Typography>
                    <Typography variant="body2" sx={{ width: 80 }}>{e.hours}h</Typography>
                    <Chip size="small" label={e.kind} sx={{ height: 20 }} />
                    {e.note && (
                      <Typography variant="body2" color="text.secondary">{e.note}</Typography>
                    )}
                  </Stack>
                ))}
              </Box>
            )}
          </Paper>
        ))}
        {list.length === 0 && (
          <Typography variant="body2" color="text.secondary">No timesheets yet.</Typography>
        )}
      </Stack>
    </Box>
  );
}
