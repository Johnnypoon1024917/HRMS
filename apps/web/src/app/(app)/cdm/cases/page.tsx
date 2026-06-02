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
import type { CaseNoteView, CaseView } from '@hrms/contracts';
import { api } from '@/lib/api';

const KINDS = [
  'warning', 'disciplinary', 'complaint', 'integrity', 'injury',
  'interdiction', 'bankruptcy', 'court', 'police',
];

const cols: GridColDef[] = [
  { field: 'staffNo', headerName: 'Staff', width: 110 },
  { field: 'staffName', headerName: 'Name', flex: 1 },
  { field: 'kind', headerName: 'Kind', width: 130 },
  { field: 'occurredOn', headerName: 'Occurred', width: 120 },
  { field: 'summary', headerName: 'Summary', flex: 1 },
  {
    field: 'classification', headerName: 'Class.', width: 110,
    renderCell: (p) => (
      <Chip size="small" label={p.value}
        color={p.value === 'restricted' ? 'warning' : 'default'} />
    ),
  },
  {
    field: 'status', headerName: 'Status', width: 110,
    renderCell: (p) => (
      <Chip size="small" label={p.value}
        color={p.value === 'open' ? 'error' : 'success'} />
    ),
  },
];

/** Conduct & Discipline + MOI cases — classification-gated. */
export default function CdmCasesPage() {
  const [rows, setRows] = useState<CaseView[]>([]);
  const [filter, setFilter] = useState({ kind: '', status: '' });
  const [f, setF] = useState({
    staffId: '',
    kind: 'warning',
    summary: '',
    occurredOn: new Date().toISOString().slice(0, 10),
    classification: 'restricted' as 'internal' | 'restricted',
  });
  const [open, setOpen] = useState<CaseView | null>(null);
  const [notes, setNotes] = useState<CaseNoteView[]>([]);
  const [newNote, setNewNote] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    const qs = new URLSearchParams();
    if (filter.kind) qs.set('kind', filter.kind);
    if (filter.status) qs.set('status', filter.status);
    api<CaseView[]>(`/cdm/cases${qs.toString() ? '?' + qs : ''}`).then(setRows);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const create = async () => {
    setErr('');
    try {
      await api('/cdm/cases', {
        method: 'POST',
        body: JSON.stringify({ ...f, status: 'open' }),
      });
      setMsg('Case opened.');
      setF({ ...f, staffId: '', summary: '' });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const openCase = async (c: CaseView) => {
    setOpen(c);
    setNotes(await api<CaseNoteView[]>(`/cdm/cases/${c.id}/notes`));
  };

  const addNote = async () => {
    if (!open || !newNote.trim()) return;
    await api(`/cdm/cases/${open.id}/notes`, {
      method: 'POST', body: JSON.stringify({ note: newNote }),
    });
    setNewNote('');
    setNotes(await api<CaseNoteView[]>(`/cdm/cases/${open.id}/notes`));
  };

  const closeCase = async () => {
    if (!open) return;
    await api(`/cdm/cases/${open.id}/close`, { method: 'POST' });
    setOpen(null);
    load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        CDM / MOI Cases
      </Typography>
      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography fontWeight={600} mb={2}>Open a case</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" label="Staff ID" value={f.staffId}
            onChange={(e) => setF({ ...f, staffId: e.target.value })} />
          <TextField select size="small" label="Kind" sx={{ minWidth: 150 }}
            value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            {KINDS.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </TextField>
          <TextField size="small" type="date" label="Occurred"
            InputLabelProps={{ shrink: true }} value={f.occurredOn}
            onChange={(e) => setF({ ...f, occurredOn: e.target.value })} />
          <TextField select size="small" label="Classification" sx={{ minWidth: 150 }}
            value={f.classification}
            onChange={(e) => setF({ ...f, classification: e.target.value as any })}>
            <MenuItem value="internal">internal</MenuItem>
            <MenuItem value="restricted">restricted</MenuItem>
          </TextField>
          <TextField size="small" label="Summary" sx={{ flexGrow: 1, minWidth: 240 }}
            value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
          <Button variant="contained" onClick={create}
            disabled={!f.staffId || !f.summary}>
            Open
          </Button>
        </Stack>
      </Paper>

      <Stack direction="row" spacing={2} mb={2}>
        <TextField select size="small" label="Filter kind" sx={{ minWidth: 150 }}
          value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.target.value })}>
          <MenuItem value="">(any)</MenuItem>
          {KINDS.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Status" sx={{ minWidth: 130 }}
          value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <MenuItem value="">(any)</MenuItem>
          <MenuItem value="open">open</MenuItem>
          <MenuItem value="closed">closed</MenuItem>
        </TextField>
        <Button onClick={load}>Apply</Button>
      </Stack>

      <div style={{ height: 420, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick
          onRowClick={(p) => openCase(p.row as CaseView)} />
      </div>

      {open && (
        <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2} mb={2}>
            <Typography fontWeight={600} flexGrow={1}>
              {open.kind.toUpperCase()} · {open.staffName ?? open.staffId} · {open.occurredOn}
            </Typography>
            {open.status === 'open' && (
              <Button size="small" variant="outlined" color="success" onClick={closeCase}>
                Close case
              </Button>
            )}
            <Button size="small" onClick={() => setOpen(null)}>Hide</Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {open.summary}
          </Typography>
          <Stack spacing={1} mb={2}>
            {notes.length === 0 && (
              <Typography variant="body2" color="text.secondary">No notes yet.</Typography>
            )}
            {notes.map((n) => (
              <Box key={n.id} sx={{ borderLeft: '3px solid', borderColor: 'divider', pl: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {new Date(n.at).toLocaleString()} · {n.byUserId}
                </Typography>
                <Typography variant="body2">{n.note}</Typography>
              </Box>
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField size="small" fullWidth placeholder="Add note…"
              value={newNote} onChange={(e) => setNewNote(e.target.value)} />
            <Button variant="contained" onClick={addNote}>Add</Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
