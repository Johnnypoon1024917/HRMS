'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { PayComponentUpsert } from '@hrms/contracts';
import { api } from '@/lib/api';

const cols: GridColDef[] = [
  { field: 'code', headerName: 'Code', width: 110 },
  { field: 'nameEn', headerName: 'Name', flex: 1 },
  { field: 'kind', headerName: 'Kind', width: 110 },
  { field: 'formula', headerName: 'Formula', flex: 1, sortable: false },
  { field: 'taxable', headerName: 'Taxable', width: 90, type: 'boolean' },
  { field: 'sequence', headerName: 'Seq', width: 80 },
];

/** Configurable pay components — formulas are tenant data, not code. */
export default function PayComponentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState<PayComponentUpsert>({
    code: '',
    nameEn: '',
    kind: 'earning',
    taxable: true,
    mpfable: true,
    formula: '',
    sequence: 100,
    active: true,
  });

  const load = () => api<any[]>('/pay/components').then(setRows);
  useEffect(() => { load(); }, []);

  const save = async () => {
    await api('/pay/components', { method: 'PUT', body: JSON.stringify(f) });
    setF({ ...f, code: '', nameEn: '', formula: '' });
    load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Pay Components
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
          <TextField size="small" label="Code" value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
          <TextField size="small" label="Name" value={f.nameEn}
            onChange={(e) => setF({ ...f, nameEn: e.target.value })} />
          <TextField select size="small" label="Kind" sx={{ minWidth: 130 }}
            value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as any })}>
            {['earning', 'deduction', 'employer'].map((k) => (
              <MenuItem key={k} value={k}>{k}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Formula" sx={{ minWidth: 240 }}
            placeholder="base * 0.1 or line('BASIC')*0.05"
            value={f.formula}
            onChange={(e) => setF({ ...f, formula: e.target.value })} />
          <TextField size="small" type="number" label="Seq" sx={{ width: 90 }}
            value={f.sequence}
            onChange={(e) => setF({ ...f, sequence: Number(e.target.value) })} />
          <FormControlLabel
            control={<Switch checked={f.taxable}
              onChange={(e) => setF({ ...f, taxable: e.target.checked })} />}
            label="Taxable" />
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
