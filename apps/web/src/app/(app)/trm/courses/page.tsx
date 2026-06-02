'use client';

import { useEffect, useState } from 'react';
import { Box, FormControlLabel, Switch, TextField } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { CourseUpsert } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';

const cols: GridColDef[] = [
  { field: 'code', headerName: 'Code', width: 110 },
  { field: 'title', headerName: 'Title', flex: 1 },
  { field: 'durationDays', headerName: 'Days', width: 80 },
  { field: 'organiser', headerName: 'Organiser', flex: 1 },
  { field: 'certificateType', headerName: 'Cert.', width: 120 },
  { field: 'certificateValidMonths', headerName: 'Valid (mo)', width: 110 },
  { field: 'active', headerName: 'Active', width: 90, type: 'boolean' },
];

const emptyForm: CourseUpsert = {
  code: '',
  title: '',
  description: '',
  durationDays: 1,
  organiser: '',
  certificateType: '',
  certificateValidMonths: 0,
  active: true,
};

/** Course catalog admin (UR-TRM-007). */
export default function CoursesPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<CourseUpsert>(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<any[]>('/trm/courses'));
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
      await api('/trm/courses', { method: 'PUT', body: JSON.stringify(f) });
      notify.success('Course saved');
      setOpen(false);
      load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Course Catalog"
        primary={{ label: 'Add course', icon: 'add', onClick: openDrawer }}
      />

      <div style={{ height: 460, width: '100%' }}>
        <DataGrid rows={rows} loading={loading} columns={cols} getRowId={(r) => r.code}
          disableRowSelectionOnClick />
      </div>

      <CrudDrawer
        open={open}
        title="Add course"
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
        <TextField type="number" label="Days" value={f.durationDays}
          onChange={(e) => setF({ ...f, durationDays: Number(e.target.value) })} />
        <TextField label="Organiser" value={f.organiser}
          onChange={(e) => setF({ ...f, organiser: e.target.value })} />
        <TextField label="Cert. type" value={f.certificateType}
          onChange={(e) => setF({ ...f, certificateType: e.target.value })} />
        <TextField type="number" label="Valid months" value={f.certificateValidMonths}
          onChange={(e) => setF({ ...f, certificateValidMonths: Number(e.target.value) })} />
        <FormControlLabel
          control={<Switch checked={f.active}
            onChange={(e) => setF({ ...f, active: e.target.checked })} />}
          label="Active" />
      </CrudDrawer>
    </Box>
  );
}
