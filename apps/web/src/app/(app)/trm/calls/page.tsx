'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';

const cols: GridColDef[] = [
  { field: 'staffId', headerName: 'Staff', flex: 1 },
  { field: 'status', headerName: 'Status', width: 130 },
  { field: 'score', headerName: 'Score', width: 90 },
  { field: 'reason', headerName: 'Reason', flex: 1 },
];

/** Call list maintenance (UR-TRM-001) + record completion (UR-TRM-006). */
export default function CallListPage() {
  const notify = useNotify();
  const [sessionId, setSessionId] = useState('');
  const [staffIds, setStaffIds] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [nominateOpen, setNominateOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [nominating, setNominating] = useState(false);
  const [recording, setRecording] = useState(false);
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
    setNominating(true);
    try {
      const ids = staffIds.split(',').map((s) => s.trim()).filter(Boolean);
      const r = await api<{ added: number; skipped: number }>('/trm/nominate', {
        method: 'POST',
        body: JSON.stringify({ sessionId, staffIds: ids }),
      });
      notify.success(`Added ${r.added}, skipped ${r.skipped}.`);
      setNominateOpen(false);
      loadEnrolments();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setNominating(false);
    }
  };

  const recordCompletion = async () => {
    setRecording(true);
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
      notify.success('Completion recorded.');
      setCompleteOpen(false);
      loadEnrolments();
    } catch (e: any) {
      notify.error(e.message);
    }
    setRecording(false);
  };

  return (
    <Box>
      <PageHeader
        title="Call List"
        primary={{
          label: 'Nominate',
          icon: 'group_add',
          onClick: () => setNominateOpen(true),
          disabled: !sessionId,
        }}
        secondary={[
          {
            label: 'Record completion',
            icon: 'task_alt',
            onClick: () => setCompleteOpen(true),
          },
        ]}
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField size="small" label="Session ID" value={sessionId}
            onChange={(e) => setSessionId(e.target.value)} />
          <Button variant="outlined" onClick={loadEnrolments} disabled={!sessionId}>
            Load
          </Button>
        </Stack>
      </Paper>

      <div style={{ height: 380, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick />
      </div>

      <CrudDrawer
        open={nominateOpen}
        title="Nominate staff"
        subtitle="Add staff to the selected session's call list"
        onClose={() => setNominateOpen(false)}
        onSubmit={nominate}
        submitLabel="Nominate"
        submitting={nominating}
        submitDisabled={!sessionId || !staffIds.trim()}
      >
        <TextField label="Session ID" value={sessionId}
          onChange={(e) => setSessionId(e.target.value)} required />
        <TextField label="Staff IDs (comma-sep)"
          value={staffIds} onChange={(e) => setStaffIds(e.target.value)} required />
      </CrudDrawer>

      <CrudDrawer
        open={completeOpen}
        title="Record completion"
        onClose={() => setCompleteOpen(false)}
        onSubmit={recordCompletion}
        submitLabel="Record"
        submitting={recording}
        submitDisabled={!complete.enrolmentId}
      >
        <TextField label="Enrolment ID" value={complete.enrolmentId}
          onChange={(e) => setComplete({ ...complete, enrolmentId: e.target.value })} required />
        <TextField select label="Outcome"
          value={complete.outcome}
          onChange={(e) =>
            setComplete({ ...complete, outcome: e.target.value as any })
          }>
          {['attended', 'absent', 'failed'].map((o) => (
            <MenuItem key={o} value={o}>{o}</MenuItem>
          ))}
        </TextField>
        <TextField type="number" label="Score"
          value={complete.score}
          onChange={(e) => setComplete({ ...complete, score: Number(e.target.value) })} />
        <TextField type="date" label="Completion date"
          InputLabelProps={{ shrink: true }} value={complete.completionDate}
          onChange={(e) => setComplete({ ...complete, completionDate: e.target.value })} />
        <TextField label="Reason"
          value={complete.reason}
          onChange={(e) => setComplete({ ...complete, reason: e.target.value })} />
      </CrudDrawer>
    </Box>
  );
}
