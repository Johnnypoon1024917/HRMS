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
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '@/lib/api';

const cols: GridColDef[] = [
  { field: 'type', headerName: 'Type', width: 110 },
  { field: 'staffId', headerName: 'Staff', flex: 1 },
  { field: 'rankCode', headerName: 'Rank', width: 90 },
  {
    field: 'effectiveFrom',
    headerName: 'From',
    width: 120,
    valueFormatter: (v: any) => new Date(v as string).toLocaleDateString(),
  },
  {
    field: 'effectiveTo',
    headerName: 'To',
    width: 120,
    valueFormatter: (v: any) =>
      v ? new Date(v as string).toLocaleDateString() : '—',
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    renderCell: (p) => (
      <Chip size="small" label={p.value}
        color={p.value === 'applied' ? 'success' : p.value === 'cancelled' ? 'default' : 'warning'} />
    ),
  },
];

/** Posting actions: transfer / acting / promotion / reversion (UR-POM). */
export default function PostingActionsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [f, setF] = useState({
    staffId: '',
    type: 'transfer',
    toPostId: '',
    rankCode: '',
    effectiveFrom: '',
    effectiveTo: '',
    reason: '',
  });

  const load = () => api<any[]>('/pom/actions').then(setRows);
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setErr('');
    setMsg('');
    try {
      await api('/pom/actions', {
        method: 'POST',
        body: JSON.stringify({
          ...f,
          toPostId: f.toPostId || undefined,
          rankCode: f.rankCode || undefined,
          effectiveTo: f.effectiveTo || undefined,
        }),
      });
      setMsg('Posting action queued.');
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const runBatch = async () => {
    const r = await api<{ processed: number }>('/pom/batch/run', { method: 'POST' });
    setMsg(`Batch applied ${r.processed} action(s).`);
    load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Posting Actions
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" label="Staff ID" value={f.staffId}
            onChange={(e) => setF({ ...f, staffId: e.target.value })} />
          <TextField select size="small" label="Type" sx={{ minWidth: 140 }}
            value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {['transfer', 'acting', 'promotion', 'reversion'].map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="To Post ID" value={f.toPostId}
            onChange={(e) => setF({ ...f, toPostId: e.target.value })} />
          <TextField size="small" label="Rank" value={f.rankCode}
            onChange={(e) => setF({ ...f, rankCode: e.target.value })} />
          <TextField size="small" type="date" label="Effective from"
            InputLabelProps={{ shrink: true }} value={f.effectiveFrom}
            onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} />
          <TextField size="small" type="date" label="Acting until"
            InputLabelProps={{ shrink: true }} value={f.effectiveTo}
            onChange={(e) => setF({ ...f, effectiveTo: e.target.value })} />
          <TextField size="small" label="Reason" sx={{ flexGrow: 1 }}
            value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          <Button variant="contained" onClick={submit}>Queue</Button>
          <Button variant="outlined" onClick={runBatch}>Run daily batch</Button>
        </Stack>
      </Paper>
      <div style={{ height: 460, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
