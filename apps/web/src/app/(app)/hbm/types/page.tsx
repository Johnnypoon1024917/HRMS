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
import type { BenefitTypeUpsert } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';

const cols: GridColDef[] = [
  { field: 'code', headerName: 'Code', width: 110 },
  { field: 'nameEn', headerName: 'Name', flex: 1 },
  { field: 'category', headerName: 'Category', width: 130 },
  { field: 'chargeable', headerName: 'Chargeable', width: 130, type: 'boolean' },
  { field: 'monthlyAmount', headerName: 'Monthly', width: 120 },
  { field: 'active', headerName: 'Active', width: 90, type: 'boolean' },
];

const emptyForm: BenefitTypeUpsert = {
  code: '',
  nameEn: '',
  category: 'housing',
  chargeable: false,
  monthlyAmount: 0,
  active: true,
};

export default function BenefitTypesPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<BenefitTypeUpsert>(emptyForm);

  const load = async () => {
    try {
      setRows(await api<any[]>('/hbm/types'));
    } catch (e: any) {
      notify.error(e.message);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDrawer = () => { setF(emptyForm); setOpen(true); };

  const save = async () => {
    setSaving(true);
    try {
      await api('/hbm/types', { method: 'PUT', body: JSON.stringify(f) });
      notify.success('Benefit type saved');
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
        title="Benefit Types"
        primary={{ label: 'Add type', icon: 'add', onClick: openDrawer }}
      />

      <div style={{ height: 460, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} getRowId={(r) => r.code}
          disableRowSelectionOnClick />
      </div>

      <CrudDrawer
        open={open}
        title="Add benefit type"
        onClose={() => setOpen(false)}
        onSubmit={save}
        submitLabel="Save"
        submitting={saving}
        submitDisabled={!f.code || !f.nameEn}
      >
        <TextField label="Code" value={f.code}
          onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
        <TextField label="Name" value={f.nameEn}
          onChange={(e) => setF({ ...f, nameEn: e.target.value })} />
        <TextField select label="Category"
          value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as any })}>
          {['housing', 'medical', 'transport', 'allowance', 'loan', 'insurance'].map((c) => (
            <MenuItem key={c} value={c}>{c}</MenuItem>
          ))}
        </TextField>
        <TextField type="number" label="Monthly"
          value={f.monthlyAmount}
          onChange={(e) => setF({ ...f, monthlyAmount: Number(e.target.value) })} />
        <FormControlLabel
          control={<Switch checked={f.chargeable}
            onChange={(e) => setF({ ...f, chargeable: e.target.checked })} />}
          label="Chargeable" />
      </CrudDrawer>
    </Box>
  );
}
