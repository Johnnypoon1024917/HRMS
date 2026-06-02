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
import type { LeaveTypeUpsert } from '@hrms/contracts';
import { api } from '@/lib/api';

const cols: GridColDef[] = [
  { field: 'code', headerName: 'Code', width: 100 },
  { field: 'nameEn', headerName: 'Name (EN)', flex: 1 },
  { field: 'nameZh', headerName: '名稱', flex: 1 },
  { field: 'annualQuota', headerName: 'Quota/yr', width: 100 },
  { field: 'paid', headerName: 'Paid', width: 80, type: 'boolean' },
  { field: 'requiresReason', headerName: 'Reason req.', width: 110, type: 'boolean' },
];

/** Tenant-configurable leave types — no code change to add a leave type. */
export default function LeaveTypesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState<LeaveTypeUpsert>({
    code: '',
    nameEn: '',
    annualQuota: 0,
    paid: true,
    requiresReason: false,
    active: true,
  });

  const load = () => api<any[]>('/lve/types').then(setRows);
  useEffect(() => { load(); }, []);

  const save = async () => {
    await api('/lve/types', { method: 'PUT', body: JSON.stringify(f) });
    setF({ ...f, code: '', nameEn: '' });
    load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Leave Types
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField size="small" label="Code" value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
          <TextField size="small" label="Name (EN)" value={f.nameEn}
            onChange={(e) => setF({ ...f, nameEn: e.target.value })} />
          <TextField size="small" type="number" label="Annual quota"
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
          <Button variant="contained" onClick={save}>Save</Button>
        </Stack>
      </Paper>
      <div style={{ height: 420, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} getRowId={(r) => r.code}
          disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
