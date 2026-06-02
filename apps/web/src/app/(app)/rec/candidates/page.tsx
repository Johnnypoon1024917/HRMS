'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { CandidateUpsert, CandidateView } from '@hrms/contracts';
import { api } from '@/lib/api';

const cols: GridColDef[] = [
  { field: 'firstName', headerName: 'First', width: 140 },
  { field: 'lastName', headerName: 'Last', width: 140 },
  { field: 'email', headerName: 'Email', flex: 1 },
  { field: 'phone', headerName: 'Phone', width: 150 },
  { field: 'source', headerName: 'Source', width: 130 },
];

export default function CandidatesPage() {
  const [rows, setRows] = useState<CandidateView[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [f, setF] = useState<CandidateUpsert>({
    firstName: '', lastName: '', email: '', phone: '', source: '',
  });
  const [apply, setApply] = useState({ candidateId: '', jobCode: '' });
  const [msg, setMsg] = useState('');

  const load = async () => {
    setRows(await api<CandidateView[]>('/rec/candidates'));
    setJobs(await api<any[]>('/rec/jobs?status=open'));
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const c = await api<CandidateView>('/rec/candidates', {
      method: 'PUT', body: JSON.stringify(f),
    });
    setMsg(`Saved candidate ${c.email}.`);
    setF({ firstName: '', lastName: '', email: '', phone: '', source: '' });
    load();
  };

  const submitApply = async () => {
    await api('/rec/applications', {
      method: 'POST', body: JSON.stringify(apply),
    });
    setMsg(`Applied ${apply.candidateId} to ${apply.jobCode}.`);
    setApply({ candidateId: '', jobCode: '' });
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Candidates
      </Typography>
      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography fontWeight={600} mb={2}>Add / update candidate</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" label="First name" value={f.firstName}
            onChange={(e) => setF({ ...f, firstName: e.target.value })} />
          <TextField size="small" label="Last name" value={f.lastName}
            onChange={(e) => setF({ ...f, lastName: e.target.value })} />
          <TextField size="small" label="Email" sx={{ minWidth: 220 }} value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })} />
          <TextField size="small" label="Phone" value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <TextField size="small" label="Source" value={f.source}
            onChange={(e) => setF({ ...f, source: e.target.value })} />
          <Button variant="contained" onClick={save}
            disabled={!f.firstName || !f.lastName || !f.email}>
            Save
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography fontWeight={600} mb={2}>Apply candidate to a job</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField size="small" label="Candidate ID" sx={{ minWidth: 220 }}
            value={apply.candidateId}
            onChange={(e) => setApply({ ...apply, candidateId: e.target.value })} />
          <TextField select size="small" label="Job" sx={{ minWidth: 220 }}
            value={apply.jobCode}
            onChange={(e) => setApply({ ...apply, jobCode: e.target.value })}>
            {jobs.map((j) => (
              <MenuItem key={j.code} value={j.code}>{j.code} — {j.title}</MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={submitApply}
            disabled={!apply.candidateId || !apply.jobCode}>
            Apply
          </Button>
        </Stack>
      </Paper>

      <div style={{ height: 460, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
