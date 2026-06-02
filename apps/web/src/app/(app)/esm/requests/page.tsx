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
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '@/lib/api';

const cols: GridColDef[] = [
  { field: 'action', headerName: 'Action', width: 100 },
  {
    field: 'effectiveDate',
    headerName: 'Effective',
    width: 130,
    valueFormatter: (v: any) => new Date(v as string).toLocaleDateString(),
  },
  {
    field: 'payload',
    headerName: 'Payload',
    flex: 1,
    valueGetter: (v: any) => (v ? JSON.stringify(v) : ''),
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    renderCell: (p) => (
      <Chip size="small" label={p.value}
        color={p.value === 'applied' ? 'success' : p.value === 'rejected' ? 'error' : 'warning'} />
    ),
  },
];

/** Post requests applied by the daily batch (UR-ESM-001). */
export default function PostRequestsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({
    action: 'create',
    effectiveDate: '',
    orgUnitId: '',
    rankCode: '',
    title: '',
  });

  const load = () => api<any[]>('/esm/requests').then(setRows);
  useEffect(() => { load(); }, []);

  const submit = async () => {
    await api('/esm/requests', {
      method: 'POST',
      body: JSON.stringify({
        action: f.action,
        effectiveDate: f.effectiveDate,
        payload: { orgUnitId: f.orgUnitId, rankCode: f.rankCode, title: f.title },
      }),
    });
    load();
  };

  const runBatch = async () => {
    await api('/esm/batch/run', { method: 'POST' });
    load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Post Requests
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField select size="small" label="Action" sx={{ minWidth: 120 }}
            value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })}>
            {['create', 'update', 'delete'].map((a) => (
              <MenuItem key={a} value={a}>{a}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" type="date" label="Effective"
            InputLabelProps={{ shrink: true }} value={f.effectiveDate}
            onChange={(e) => setF({ ...f, effectiveDate: e.target.value })} />
          <TextField size="small" label="Org Unit ID" value={f.orgUnitId}
            onChange={(e) => setF({ ...f, orgUnitId: e.target.value })} />
          <TextField size="small" label="Rank" value={f.rankCode}
            onChange={(e) => setF({ ...f, rankCode: e.target.value })} />
          <TextField size="small" label="Title" value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Button variant="contained" onClick={submit}>Submit</Button>
          <Button variant="outlined" onClick={runBatch}>Run daily batch</Button>
        </Stack>
      </Paper>
      <div style={{ height: 460, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
