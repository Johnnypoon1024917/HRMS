'use client';

import { useState } from 'react';
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
import { api } from '@/lib/api';

const cols: GridColDef[] = [
  { field: 'staffId', headerName: 'Staff', flex: 1 },
  { field: 'status', headerName: 'Status', width: 130 },
  { field: 'score', headerName: 'Score', width: 90 },
  { field: 'reason', headerName: 'Reason', flex: 1 },
];

/** Call list maintenance (UR-TRM-001) + record completion (UR-TRM-006). */
export default function CallListPage() {
  const [sessionId, setSessionId] = useState('');
  const [staffIds, setStaffIds] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [complete, setComplete] = useState({
    enrolmentId: '',
    outcome: 'attended' as 'attended' | 'absent' | 'failed',
    score: 0,
    completionDate: '',
    reason: '',
  });

  const loadEnrolments = () =>
    sessionId &&
    api<any[]>(`/trm/sessions/${sessionId}/enrolments`).then(setRows);

  const nominate = async () => {
    setErr('');
    setMsg('');
    try {
      const ids = staffIds.split(',').map((s) => s.trim()).filter(Boolean);
      const r = await api<{ added: number; skipped: number }>('/trm/nominate', {
        method: 'POST',
        body: JSON.stringify({ sessionId, staffIds: ids }),
      });
      setMsg(`Added ${r.added}, skipped ${r.skipped}.`);
      loadEnrolments();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const recordCompletion = async () => {
    setErr('');
    setMsg('');
    try {
      await api('/trm/completion', {
        method: 'POST',
        body: JSON.stringify({
          enrolmentId: complete.enrolmentId,
          outcome: complete.outcome,
          score: complete.score || undefined,
          completionDate: complete.completionDate || undefined,
          reason: complete.reason || undefined,
        }),
      });
      setMsg('Completion recorded.');
      loadEnrolments();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Call List
      </Typography>
      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField size="small" label="Session ID" value={sessionId}
            onChange={(e) => setSessionId(e.target.value)} />
          <TextField size="small" label="Staff IDs (comma-sep)" sx={{ flexGrow: 1 }}
            value={staffIds} onChange={(e) => setStaffIds(e.target.value)} />
          <Button variant="contained" onClick={nominate} disabled={!sessionId}>
            Nominate
          </Button>
          <Button variant="outlined" onClick={loadEnrolments} disabled={!sessionId}>
            Load
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography fontWeight={600} mb={2}>Record completion</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" label="Enrolment ID" value={complete.enrolmentId}
            onChange={(e) => setComplete({ ...complete, enrolmentId: e.target.value })} />
          <TextField select size="small" label="Outcome" sx={{ minWidth: 140 }}
            value={complete.outcome}
            onChange={(e) =>
              setComplete({ ...complete, outcome: e.target.value as any })
            }>
            {['attended', 'absent', 'failed'].map((o) => (
              <MenuItem key={o} value={o}>{o}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" type="number" label="Score" sx={{ width: 110 }}
            value={complete.score}
            onChange={(e) => setComplete({ ...complete, score: Number(e.target.value) })} />
          <TextField size="small" type="date" label="Completion date"
            InputLabelProps={{ shrink: true }} value={complete.completionDate}
            onChange={(e) => setComplete({ ...complete, completionDate: e.target.value })} />
          <TextField size="small" label="Reason" sx={{ flexGrow: 1 }}
            value={complete.reason}
            onChange={(e) => setComplete({ ...complete, reason: e.target.value })} />
          <Button variant="contained" onClick={recordCompletion}
            disabled={!complete.enrolmentId}>
            Record
          </Button>
        </Stack>
      </Paper>

      <div style={{ height: 380, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
