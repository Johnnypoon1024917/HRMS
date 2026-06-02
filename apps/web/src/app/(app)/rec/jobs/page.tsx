'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Chip, MenuItem, TextField } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useRouter } from 'next/navigation';
import type { JobOpeningView } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';

const emptyForm = {
  code: '',
  title: '',
  rankCode: '',
  openings: 1,
  description: '',
  status: 'open' as 'draft' | 'open' | 'on_hold' | 'closed',
};

export default function JobsPage() {
  const router = useRouter();
  const notify = useNotify();
  const [rows, setRows] = useState<JobOpeningView[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<JobOpeningView[]>('/rec/jobs'));
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDrawer = () => { setF(emptyForm); setOpen(true); };

  const save = async () => {
    setSaving(true);
    try {
      await api('/rec/jobs', { method: 'PUT', body: JSON.stringify(f) });
      notify.success('Job opening saved');
      setOpen(false);
      load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
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
      <PageHeader
        title="Job Openings"
        primary={{ label: 'New job', icon: 'add', onClick: openDrawer }}
      />

      <div style={{ height: 460, width: '100%' }}>
        <DataGrid rows={rows} loading={loading} columns={cols} disableRowSelectionOnClick />
      </div>

      <CrudDrawer
        open={open}
        title="New job opening"
        onClose={() => setOpen(false)}
        onSubmit={save}
        submitLabel="Save"
        submitting={saving}
        submitDisabled={!f.code || !f.title}
      >
        <TextField label="Code" value={f.code}
          onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
        <TextField label="Title" value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })} />
        <TextField label="Rank" value={f.rankCode}
          onChange={(e) => setF({ ...f, rankCode: e.target.value })} />
        <TextField type="number" label="Openings" value={f.openings}
          onChange={(e) => setF({ ...f, openings: Number(e.target.value) })} />
        <TextField label="Description" multiline minRows={2} value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })} />
        <TextField select label="Status" value={f.status}
          onChange={(e) => setF({ ...f, status: e.target.value as any })}>
          {['draft', 'open', 'on_hold', 'closed'].map((s) => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
        </TextField>
      </CrudDrawer>
    </Box>
  );
}
