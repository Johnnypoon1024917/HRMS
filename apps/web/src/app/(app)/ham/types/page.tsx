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
import type { AwardTypeUpsert } from '@hrms/contracts';
import { api } from '@/lib/api';

const cols: GridColDef[] = [
  { field: 'code', headerName: 'Code', width: 110 },
  { field: 'nameEn', headerName: 'Name', flex: 1 },
  { field: 'kind', headerName: 'Kind', width: 130 },
  { field: 'lsiYears', headerName: 'LSI yrs', width: 110 },
  { field: 'active', headerName: 'Active', width: 90, type: 'boolean' },
];

export default function AwardTypesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState<AwardTypeUpsert>({
    code: '',
    nameEn: '',
    kind: 'recognition',
    active: true,
  });

  const load = () => api<any[]>('/ham/types').then(setRows);
  useEffect(() => { load(); }, []);

  const save = async () => {
    await api('/ham/types', { method: 'PUT', body: JSON.stringify(f) });
    setF({ ...f, code: '', nameEn: '', lsiYears: undefined });
    load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Award Types
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField size="small" label="Code" value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
          <TextField size="small" label="Name (EN)" value={f.nameEn}
            onChange={(e) => setF({ ...f, nameEn: e.target.value })} />
          <TextField select size="small" label="Kind" sx={{ minWidth: 140 }}
            value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as any })}>
            {['medal', 'travel', 'lsi', 'recognition'].map((k) => (
              <MenuItem key={k} value={k}>{k}</MenuItem>
            ))}
          </TextField>
          {f.kind === 'lsi' && (
            <TextField size="small" type="number" label="LSI years" sx={{ width: 130 }}
              value={f.lsiYears ?? ''}
              onChange={(e) => setF({ ...f, lsiYears: Number(e.target.value) })} />
          )}
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
