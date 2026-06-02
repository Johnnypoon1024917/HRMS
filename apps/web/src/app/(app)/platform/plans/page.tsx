'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { PlanUpsert, PlanView } from '@hrms/contracts';
import { api } from '@/lib/api';

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

/** Platform-operator plan catalog. Stripe Prices are wired here. */
export default function PlansAdmin() {
  const [rows, setRows] = useState<PlanView[]>([]);
  const [f, setF] = useState<PlanUpsert>({
    code: '', name: '',
    monthlyPrice: 0, currency: 'USD',
    includedModules: [], maxSeats: 0, perSeatOverage: 0,
    active: true,
  });
  const [modulesStr, setModulesStr] = useState('');

  const load = () => api<PlanView[]>('/bil/plans').then(setRows);
  useEffect(() => { load(); }, []);

  const save = async () => {
    await api('/bil/plans', {
      method: 'PUT',
      body: JSON.stringify({
        ...f,
        includedModules: modulesStr.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    });
    setF({ ...f, code: '', name: '' });
    setModulesStr('');
    load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Plans (operator)
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" label="Code" value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.toLowerCase() })} />
          <TextField size="small" label="Name" value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })} />
          <TextField size="small" type="number" label="Price (cents)" sx={{ width: 140 }}
            value={f.monthlyPrice}
            onChange={(e) => setF({ ...f, monthlyPrice: Number(e.target.value) })} />
          <TextField size="small" label="Currency" sx={{ width: 90 }}
            value={f.currency}
            onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} />
          <TextField size="small" type="number" label="Max seats" sx={{ width: 120 }}
            value={f.maxSeats}
            onChange={(e) => setF({ ...f, maxSeats: Number(e.target.value) })} />
          <TextField size="small" label="Modules (comma-sep)" sx={{ minWidth: 260, flexGrow: 1 }}
            value={modulesStr} onChange={(e) => setModulesStr(e.target.value)} />
          <TextField size="small" label="Stripe priceId" value={f.stripePriceId ?? ''}
            onChange={(e) => setF({ ...f, stripePriceId: e.target.value })} />
          <FormControlLabel
            control={<Switch checked={f.active}
              onChange={(e) => setF({ ...f, active: e.target.checked })} />}
            label="Active" />
          <Button variant="contained" onClick={save}>Save</Button>
        </Stack>
      </Paper>

      <div style={{ height: 460, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} getRowId={(r) => r.code}
          disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
