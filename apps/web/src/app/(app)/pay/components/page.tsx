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
import type { PayComponentUpsert } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';

const cols: GridColDef[] = [
  { field: 'code', headerName: 'Code', width: 110 },
  { field: 'nameEn', headerName: 'Name', flex: 1 },
  { field: 'kind', headerName: 'Kind', width: 110 },
  { field: 'formula', headerName: 'Formula', flex: 1, sortable: false },
  { field: 'taxable', headerName: 'Taxable', width: 90, type: 'boolean' },
  { field: 'sequence', headerName: 'Seq', width: 80 },
];

const emptyForm: PayComponentUpsert = {
  code: '',
  nameEn: '',
  kind: 'earning',
  taxable: true,
  mpfable: true,
  formula: '',
  sequence: 100,
  active: true,
};

/** Configurable pay components — formulas are tenant data, not code. */
export default function PayComponentsPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<PayComponentUpsert>(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<any[]>('/pay/components'));
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
      await api('/pay/components', { method: 'PUT', body: JSON.stringify(f) });
      notify.success('Pay component saved');
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
        title="Pay Components"
        primary={{ label: 'Add component', icon: 'add', onClick: openDrawer }}
      />

      <div style={{ height: 460, width: '100%' }}>
        <DataGrid rows={rows} loading={loading} columns={cols} getRowId={(r) => r.code}
          disableRowSelectionOnClick />
      </div>

      <CrudDrawer
        open={open}
        title="Add pay component"
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
        <TextField select label="Kind"
          value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as any })}>
          {['earning', 'deduction', 'employer'].map((k) => (
            <MenuItem key={k} value={k}>{k}</MenuItem>
          ))}
        </TextField>
        <TextField label="Formula"
          placeholder="base * 0.1 or line('BASIC')*0.05"
          value={f.formula}
          onChange={(e) => setF({ ...f, formula: e.target.value })} />
        <TextField type="number" label="Seq"
          value={f.sequence}
          onChange={(e) => setF({ ...f, sequence: Number(e.target.value) })} />
        <FormControlLabel
          control={<Switch checked={f.taxable}
            onChange={(e) => setF({ ...f, taxable: e.target.checked })} />}
          label="Taxable" />
      </CrudDrawer>
    </Box>
  );
}
