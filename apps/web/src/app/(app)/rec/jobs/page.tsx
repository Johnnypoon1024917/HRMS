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
import { useRouter } from 'next/navigation';
import type { JobOpeningView } from '@hrms/contracts';
import { api } from '@/lib/api';

export default function JobsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<JobOpeningView[]>([]);
  const [f, setF] = useState({
    code: '',
    title: '',
    rankCode: '',
    openings: 1,
    description: '',
    status: 'open' as 'draft' | 'open' | 'on_hold' | 'closed',
  });

  const load = () => api<JobOpeningView[]>('/rec/jobs').then(setRows);
  useEffect(() => { load(); }, []);

  const save = async () => {
    await api('/rec/jobs', { method: 'PUT', body: JSON.stringify(f) });
    setF({ ...f, code: '', title: '' });
    load();
  };

  const cols: GridColDef[] = [
    { field: 'code', headerName: 'Code', width: 130 },
    { field: 'title', headerName: 'Title', flex: 1 },
    { field: 'openings', headerName: 'Openings', width: 100 },
    { field: 'applicants', headerName: 'Applicants', width: 110 },
    { field: 'hired', headerName: 'Hired', width: 90 },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: (p) => (
        <Chip size="small" label={p.value}
          color={p.value === 'open' ? 'success' : p.value === 'closed' ? 'default' : 'warning'} />
      ),
    },
    {
      field: 'actions', headerName: '', width: 140, sortable: false,
      renderCell: (p) => (
        <Button size="small" onClick={() => router.push(`/rec/pipeline?code=${p.row.code}`)}>
          Pipeline →
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Job Openings
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" label="Code" value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
          <TextField size="small" label="Title" sx={{ minWidth: 220 }} value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })} />
          <TextField size="small" label="Rank" value={f.rankCode}
            onChange={(e) => setF({ ...f, rankCode: e.target.value })} />
          <TextField size="small" type="number" label="Openings" sx={{ width: 110 }}
            value={f.openings}
            onChange={(e) => setF({ ...f, openings: Number(e.target.value) })} />
          <TextField select size="small" label="Status" sx={{ minWidth: 130 }}
            value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as any })}>
            {['draft', 'open', 'on_hold', 'closed'].map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={save}
            disabled={!f.code || !f.title}>
            Save
          </Button>
        </Stack>
      </Paper>
      <div style={{ height: 460, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
