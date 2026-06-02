'use client';

import { useEffect, useState } from 'react';
import { Box, FormControlLabel, Switch, TextField } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { LeaveTypeUpsert } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';

const cols: GridColDef[] = [
  { field: 'code', headerName: 'Code', width: 100 },
  { field: 'nameEn', headerName: 'Name (EN)', flex: 1 },
  { field: 'nameZh', headerName: '名稱', flex: 1 },
  { field: 'annualQuota', headerName: 'Quota/yr', width: 100 },
  { field: 'paid', headerName: 'Paid', width: 80, type: 'boolean' },
  { field: 'requiresReason', headerName: 'Reason req.', width: 110, type: 'boolean' },
];

const emptyForm: LeaveTypeUpsert = {
  code: '',
  nameEn: '',
  annualQuota: 0,
  paid: true,
  requiresReason: false,
  active: true,
};

/** Tenant-configurable leave types — no code change to add a leave type. */
export default function LeaveTypesPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<LeaveTypeUpsert>(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<any[]>('/lve/types'));
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
      await api('/lve/types', { method: 'PUT', body: JSON.stringify(f) });
      notify.success('Leave type saved');
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
        title="Leave Types"
        primary={{ label: 'Add leave type', icon: 'add', onClick: openDrawer }}
      />

      <div style={{ height: 420, width: '100%' }}>
        <DataGrid rows={rows} loading={loading} columns={cols} getRowId={(r) => r.code}
          disableRowSelectionOnClick />
      </div>

      <CrudDrawer
        open={open}
        title="Add leave type"
        onClose={() => setOpen(false)}
        onSubmit={save}
        submitLabel="Save"
        submitting={saving}
        submitDisabled={!f.code || !f.nameEn}
      >
        <TextField label="Code" value={f.code}
          onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} required />
        <TextField label="Name (EN)" value={f.nameEn}
          onChange={(e) => setF({ ...f, nameEn: e.target.value })} required />
        <TextField type="number" label="Annual quota"
          value={f.annualQuota}
          onChange={(e) => setF({ ...f, annualQuota: Number(e.target.value) })} />
        <FormControlLabel
          control={<Switch checked={f.paid}
            onChange={(e) => setF({ ...f, paid: e.target.checked })} />}
          label="Paid" />
        <FormControlLabel
          control={<Switch checked={f.requiresReason}
            onChange={(e) => setF({ ...f, requiresReason: e.target.checked })} />}
          label="Reason required" />
      </CrudDrawer>
    </Box>
  );
}
