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
import type { ExitView } from '@hrms/contracts';
import { api } from '@/lib/api';

const REASONS = [
  'retirement', 'compulsory_retirement', 'dismissal', 'invaliding',
  'resignation', 'death', 'end_of_contract', 'posting_out',
  'reversion', 'termination',
];

const cols: GridColDef[] = [
  { field: 'staffNo', headerName: 'Staff', width: 110 },
  { field: 'staffName', headerName: 'Name', flex: 1 },
  { field: 'reason', headerName: 'Reason', width: 170 },
  { field: 'effectiveDate', headerName: 'Effective', width: 130 },
  {
    field: 'status', headerName: 'Status', width: 130,
    renderCell: (p) => (
      <Chip size="small" label={p.value}
        color={p.value === 'applied' ? 'success' : p.value === 'cancelled' ? 'default' : 'warning'} />
    ),
  },
];

/** Exit / offboarding records (UR-EXM-002): pending → applied via batch. */
export default function ExitsPage() {
  const [rows, setRows] = useState<ExitView[]>([]);
  const [f, setF] = useState({
    staffId: '',
    reason: 'retirement',
    effectiveDate: '',
    interviewNotes: '',
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => api<ExitView[]>('/exm/exits').then(setRows);
  useEffect(() => { load(); }, []);

  const create = async () => {
    setErr('');
    try {
      await api('/exm/exits', { method: 'POST', body: JSON.stringify(f) });
      setMsg('Exit record queued.');
      setF({ ...f, staffId: '', effectiveDate: '', interviewNotes: '' });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const runBatch = async () => {
    const r = await api<{ processed: number }>('/exm/batch/run', { method: 'POST' });
    setMsg(`Applied ${r.processed} exit(s).`);
    load();
  };

  const cancel = async (id: string) => {
    await api(`/exm/exits/${id}/cancel`, { method: 'POST' });
    load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Exit Records
      </Typography>
      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" label="Staff ID" value={f.staffId}
            onChange={(e) => setF({ ...f, staffId: e.target.value })} />
          <TextField select size="small" label="Reason" sx={{ minWidth: 200 }}
            value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>
            {REASONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <TextField size="small" type="date" label="Effective date"
            InputLabelProps={{ shrink: true }} value={f.effectiveDate}
            onChange={(e) => setF({ ...f, effectiveDate: e.target.value })} />
          <TextField size="small" label="Interview notes" sx={{ flexGrow: 1, minWidth: 240 }}
            value={f.interviewNotes}
            onChange={(e) => setF({ ...f, interviewNotes: e.target.value })} />
          <Button variant="contained" onClick={create}
            disabled={!f.staffId || !f.effectiveDate}>
            Queue
          </Button>
          <Button variant="outlined" onClick={runBatch}>Run daily batch</Button>
        </Stack>
      </Paper>

      <div style={{ height: 480, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={[
            ...cols,
            {
              field: 'actions', headerName: '', width: 110, sortable: false,
              renderCell: (p) =>
                p.row.status === 'pending' ? (
                  <Button size="small" color="error" onClick={() => cancel(p.row.id)}>
                    Cancel
                  </Button>
                ) : null,
            },
          ]}
          disableRowSelectionOnClick
        />
      </div>
    </Box>
  );
}
