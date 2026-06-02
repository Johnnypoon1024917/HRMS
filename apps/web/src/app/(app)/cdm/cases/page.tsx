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
import type { CaseNoteView, CaseView } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { StaffPicker } from '@/components/inputs/StaffPicker';
import { useNotify } from '@/components/feedback/Notify';

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

const emptyForm = {
  staffId: '',
  kind: 'warning',
  summary: '',
  occurredOn: new Date().toISOString().slice(0, 10),
  classification: 'restricted' as 'internal' | 'restricted',
};

/** Conduct & Discipline + MOI cases — classification-gated. */
export default function CdmCasesPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<CaseView[]>([]);
  const [filter, setFilter] = useState({ kind: '', status: '' });
  const [f, setF] = useState(emptyForm);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<CaseView | null>(null);
  const [notes, setNotes] = useState<CaseNoteView[]>([]);
  const [newNote, setNewNote] = useState('');

  const load = () => {
    const qs = new URLSearchParams();
    if (filter.kind) qs.set('kind', filter.kind);
    if (filter.status) qs.set('status', filter.status);
    api<CaseView[]>(`/cdm/cases${qs.toString() ? '?' + qs : ''}`)
      .then(setRows)
      .catch((e: any) => notify.error(e.message));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDrawer = () => { setF(emptyForm); setDrawerOpen(true); };

  const create = async () => {
    setSaving(true);
    try {
      await api('/cdm/cases', {
        method: 'POST',
        body: JSON.stringify({ ...f, status: 'open' }),
      });
      notify.success('Case opened.');
      setDrawerOpen(false);
      load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openCase = async (c: CaseView) => {
    setOpen(c);
    try {
      setNotes(await api<CaseNoteView[]>(`/cdm/cases/${c.id}/notes`));
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  const addNote = async () => {
    if (!open || !newNote.trim()) return;
    try {
      await api(`/cdm/cases/${open.id}/notes`, {
        method: 'POST', body: JSON.stringify({ note: newNote }),
      });
      setNewNote('');
      setNotes(await api<CaseNoteView[]>(`/cdm/cases/${open.id}/notes`));
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  const closeCase = async () => {
    if (!open) return;
    try {
      await api(`/cdm/cases/${open.id}/close`, { method: 'POST' });
      notify.success('Case closed.');
      setOpen(null);
      load();
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title="CDM / MOI Cases"
        primary={{ label: 'Open a case', icon: 'add', onClick: openDrawer }}
      />

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

      <CrudDrawer
        open={drawerOpen}
        title="Open a case"
        onClose={() => setDrawerOpen(false)}
        onSubmit={create}
        submitLabel="Open"
        submitting={saving}
        submitDisabled={!f.staffId || !f.summary}
      >
        <StaffPicker
          value={f.staffId || null}
          onChange={(id) => setF({ ...f, staffId: id ?? '' })}
          required
        />
        <TextField select label="Kind" value={f.kind}
          onChange={(e) => setF({ ...f, kind: e.target.value })}>
          {KINDS.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
        </TextField>
        <TextField type="date" label="Occurred" InputLabelProps={{ shrink: true }}
          value={f.occurredOn}
          onChange={(e) => setF({ ...f, occurredOn: e.target.value })} />
        <TextField select label="Classification" value={f.classification}
          onChange={(e) => setF({ ...f, classification: e.target.value as any })}>
          <MenuItem value="internal">internal</MenuItem>
          <MenuItem value="restricted">restricted</MenuItem>
        </TextField>
        <TextField label="Summary" value={f.summary}
          onChange={(e) => setF({ ...f, summary: e.target.value })} />
      </CrudDrawer>
    </Box>
  );
}
