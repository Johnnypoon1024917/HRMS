'use client';

import { useEffect, useState } from 'react';
import { Box, Chip, MenuItem, TextField } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { StaffPicker } from '@/components/inputs/StaffPicker';
import { useNotify } from '@/components/feedback/Notify';

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

const emptyForm = {
  staffId: '',
  type: 'transfer',
  toPostId: '',
  rankCode: '',
  effectiveFrom: '',
  effectiveTo: '',
  reason: '',
};

/** Posting actions: transfer / acting / promotion / reversion (UR-POM). */
export default function PostingActionsPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(emptyForm);

  const load = () => api<any[]>('/pom/actions').then(setRows);
  useEffect(() => { load(); }, []);

  const openDrawer = () => { setF(emptyForm); setOpen(true); };

  const submit = async () => {
    setSaving(true);
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
      notify.success('Posting action queued.');
      setOpen(false);
      load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const runBatch = async () => {
    try {
      const r = await api<{ processed: number }>('/pom/batch/run', { method: 'POST' });
      notify.success(`Batch applied ${r.processed} action(s).`);
      load();
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Posting Actions"
        primary={{ label: 'Queue action', icon: 'add', onClick: openDrawer }}
        secondary={[{ label: 'Run daily batch', icon: 'play_arrow', onClick: runBatch }]}
      />

      <div style={{ height: 460, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick />
      </div>

      <CrudDrawer
        open={open}
        title="Queue posting action"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Queue"
        submitting={saving}
        submitDisabled={!f.staffId || !f.effectiveFrom}
      >
        <StaffPicker
          value={f.staffId || null}
          onChange={(id) => setF({ ...f, staffId: id ?? '' })}
          required
        />
        <TextField select label="Type" value={f.type}
          onChange={(e) => setF({ ...f, type: e.target.value })}>
          {['transfer', 'acting', 'promotion', 'reversion'].map((t) => (
            <MenuItem key={t} value={t}>{t}</MenuItem>
          ))}
        </TextField>
        <TextField label="To Post ID" value={f.toPostId}
          onChange={(e) => setF({ ...f, toPostId: e.target.value })} />
        <TextField label="Rank" value={f.rankCode}
          onChange={(e) => setF({ ...f, rankCode: e.target.value })} />
        <TextField type="date" label="Effective from"
          InputLabelProps={{ shrink: true }} value={f.effectiveFrom}
          onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} />
        <TextField type="date" label="Acting until"
          InputLabelProps={{ shrink: true }} value={f.effectiveTo}
          onChange={(e) => setF({ ...f, effectiveTo: e.target.value })} />
        <TextField label="Reason" value={f.reason}
          onChange={(e) => setF({ ...f, reason: e.target.value })} />
      </CrudDrawer>
    </Box>
  );
}
