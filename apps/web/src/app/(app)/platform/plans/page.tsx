'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  FormControlLabel,
  Switch,
  TextField,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { PlanUpsert, PlanView } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';

const cols: GridColDef[] = [
  { field: 'code', headerName: 'Code', width: 130 },
  { field: 'name', headerName: 'Name', flex: 1 },
  { field: 'monthlyPrice', headerName: 'Price (¢)', width: 110 },
  { field: 'currency', headerName: 'Ccy', width: 80 },
  { field: 'maxSeats', headerName: 'Seats', width: 90 },
  {
    field: 'includedModules', headerName: 'Modules', flex: 1,
    valueGetter: (v: any) => (Array.isArray(v) ? v.join(', ') : ''),
  },
  { field: 'active', headerName: 'Active', width: 90, type: 'boolean' },
];

const emptyForm: PlanUpsert = {
  code: '', name: '',
  monthlyPrice: 0, currency: 'USD',
  includedModules: [], maxSeats: 0, perSeatOverage: 0,
  active: true,
};

/** Platform-operator plan catalog. Stripe Prices are wired here. */
export default function PlansAdmin() {
  const notify = useNotify();
  const [rows, setRows] = useState<PlanView[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<PlanUpsert>(emptyForm);
  const [modulesStr, setModulesStr] = useState('');

  const load = async () => {
    try {
      setRows(await api<PlanView[]>('/bil/plans'));
    } catch (e: any) {
      notify.error(e.message);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDrawer = () => {
    setF(emptyForm);
    setModulesStr('');
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api('/bil/plans', {
        method: 'PUT',
        body: JSON.stringify({
          ...f,
          includedModules: modulesStr.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      notify.success('Plan saved');
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
        title="Plans (operator)"
        primary={{ label: 'Add plan', icon: 'add', onClick: openDrawer }}
      />

      <div style={{ height: 460, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} getRowId={(r) => r.code}
          disableRowSelectionOnClick />
      </div>

      <CrudDrawer
        open={open}
        title="Plan"
        onClose={() => setOpen(false)}
        onSubmit={save}
        submitLabel="Save"
        submitting={saving}
        submitDisabled={!f.code || !f.name}
      >
        <TextField size="small" label="Code" value={f.code} required
          onChange={(e) => setF({ ...f, code: e.target.value.toLowerCase() })} />
        <TextField size="small" label="Name" value={f.name} required
          onChange={(e) => setF({ ...f, name: e.target.value })} />
        <TextField size="small" type="number" label="Price (cents)"
          value={f.monthlyPrice}
          onChange={(e) => setF({ ...f, monthlyPrice: Number(e.target.value) })} />
        <TextField size="small" label="Currency"
          value={f.currency}
          onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} />
        <TextField size="small" type="number" label="Max seats"
          value={f.maxSeats}
          onChange={(e) => setF({ ...f, maxSeats: Number(e.target.value) })} />
        <TextField size="small" label="Modules (comma-sep)"
          value={modulesStr} onChange={(e) => setModulesStr(e.target.value)} />
        <TextField size="small" label="Stripe priceId" value={f.stripePriceId ?? ''}
          onChange={(e) => setF({ ...f, stripePriceId: e.target.value })} />
        <FormControlLabel
          control={<Switch checked={f.active}
            onChange={(e) => setF({ ...f, active: e.target.checked })} />}
          label="Active" />
      </CrudDrawer>
    </Box>
  );
}
