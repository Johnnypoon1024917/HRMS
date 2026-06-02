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
import type { BenefitTypeUpsert } from '@hrms/contracts';
import { api } from '@/lib/api';

const cols: GridColDef[] = [
  { field: 'code', headerName: 'Code', width: 110 },
  { field: 'nameEn', headerName: 'Name', flex: 1 },
  { field: 'category', headerName: 'Category', width: 130 },
  { field: 'chargeable', headerName: 'Chargeable', width: 130, type: 'boolean' },
  { field: 'monthlyAmount', headerName: 'Monthly', width: 120 },
  { field: 'active', headerName: 'Active', width: 90, type: 'boolean' },
];

export default function BenefitTypesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState<BenefitTypeUpsert>({
    code: '',
    nameEn: '',
    category: 'housing',
    chargeable: false,
    monthlyAmount: 0,
    active: true,
  });

  const load = () => api<any[]>('/hbm/types').then(setRows);
  useEffect(() => { load(); }, []);

  const save = async () => {
    await api('/hbm/types', { method: 'PUT', body: JSON.stringify(f) });
    setF({ ...f, code: '', nameEn: '' });
    load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Benefit Types
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" label="Code" value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
          <TextField size="small" label="Name" value={f.nameEn}
            onChange={(e) => setF({ ...f, nameEn: e.target.value })} />
          <TextField select size="small" label="Category" sx={{ minWidth: 150 }}
            value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as any })}>
            {['housing', 'medical', 'transport', 'allowance', 'loan', 'insurance'].map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" type="number" label="Monthly" sx={{ width: 130 }}
            value={f.monthlyAmount}
            onChange={(e) => setF({ ...f, monthlyAmount: Number(e.target.value) })} />
          <FormControlLabel
            control={<Switch checked={f.chargeable}
              onChange={(e) => setF({ ...f, chargeable: e.target.checked })} />}
            label="Chargeable" />
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
