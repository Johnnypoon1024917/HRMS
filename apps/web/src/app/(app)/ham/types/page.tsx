'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { AwardTypeUpsert } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';

const cols: GridColDef[] = [
  { field: 'code', headerName: 'Code', width: 110 },
  { field: 'nameEn', headerName: 'Name', flex: 1 },
  { field: 'kind', headerName: 'Kind', width: 130 },
  { field: 'lsiYears', headerName: 'LSI yrs', width: 110 },
  { field: 'active', headerName: 'Active', width: 90, type: 'boolean' },
];

const emptyForm: AwardTypeUpsert = {
  code: '',
  nameEn: '',
  kind: 'recognition',
  active: true,
};

export default function AwardTypesPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<AwardTypeUpsert>(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<any[]>('/ham/types'));
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
      await api('/ham/types', { method: 'PUT', body: JSON.stringify(f) });
      notify.success('Award type saved');
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
        title="Award Types"
        primary={{ label: 'Add award type', icon: 'add', onClick: openDrawer }}
      />

      <div style={{ height: 460, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} loading={loading} getRowId={(r) => r.code}
          disableRowSelectionOnClick />
      </div>

      <CrudDrawer
        open={open}
        title="Add award type"
        onClose={() => setOpen(false)}
        onSubmit={save}
        submitLabel="Save"
        submitting={saving}
        submitDisabled={!f.code || !f.nameEn}
      >
        <TextField label="Code" value={f.code}
          onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
        <TextField label="Name (EN)" value={f.nameEn}
          onChange={(e) => setF({ ...f, nameEn: e.target.value })} />
        <TextField select label="Kind"
          value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as any })}>
          {['medal', 'travel', 'lsi', 'recognition'].map((k) => (
            <MenuItem key={k} value={k}>{k}</MenuItem>
          ))}
        </TextField>
        {f.kind === 'lsi' && (
          <TextField type="number" label="LSI years"
            value={f.lsiYears ?? ''}
            onChange={(e) => setF({ ...f, lsiYears: Number(e.target.value) })} />
        )}
        <FormControlLabel
          control={<Switch checked={f.active}
            onChange={(e) => setF({ ...f, active: e.target.checked })} />}
          label="Active" />
      </CrudDrawer>
    </Box>
  );
}
