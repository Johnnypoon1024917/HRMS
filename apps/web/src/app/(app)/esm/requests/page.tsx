'use client';

import { useEffect, useState } from 'react';
import { Box, Chip, MenuItem, TextField } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';

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

const emptyForm = {
  action: 'create',
  effectiveDate: '',
  orgUnitId: '',
  rankCode: '',
  title: '',
};

/** Post requests applied by the daily batch (UR-ESM-001). */
export default function PostRequestsPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<any[]>('/esm/requests'));
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDrawer = () => { setF(emptyForm); setOpen(true); };

  const submit = async () => {
    setSaving(true);
    try {
      await api('/esm/requests', {
        method: 'POST',
        body: JSON.stringify({
          action: f.action,
          effectiveDate: f.effectiveDate,
          payload: { orgUnitId: f.orgUnitId, rankCode: f.rankCode, title: f.title },
        }),
      });
      notify.success('Request submitted');
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
      await api('/esm/batch/run', { method: 'POST' });
      notify.success('Daily batch run');
      load();
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Post Requests"
        primary={{ label: 'New request', icon: 'add', onClick: openDrawer }}
        secondary={[{ label: 'Run daily batch', icon: 'play_arrow', onClick: runBatch }]}
      />

      <div style={{ height: 460, width: '100%' }}>
        <DataGrid rows={rows} loading={loading} columns={cols} disableRowSelectionOnClick />
      </div>

      <CrudDrawer
        open={open}
        title="New post request"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Submit"
        submitting={saving}
        submitDisabled={!f.action || !f.effectiveDate}
      >
        <TextField select label="Action" value={f.action}
          onChange={(e) => setF({ ...f, action: e.target.value })}>
          {['create', 'update', 'delete'].map((a) => (
            <MenuItem key={a} value={a}>{a}</MenuItem>
          ))}
        </TextField>
        <TextField type="date" label="Effective" InputLabelProps={{ shrink: true }}
          value={f.effectiveDate}
          onChange={(e) => setF({ ...f, effectiveDate: e.target.value })} />
        <TextField label="Org Unit ID" value={f.orgUnitId}
          onChange={(e) => setF({ ...f, orgUnitId: e.target.value })} />
        <TextField label="Rank" value={f.rankCode}
          onChange={(e) => setF({ ...f, rankCode: e.target.value })} />
        <TextField label="Title" value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })} />
      </CrudDrawer>
    </Box>
  );
}
