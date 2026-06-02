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
import type { CourseUpsert } from '@hrms/contracts';
import { api } from '@/lib/api';

const cols: GridColDef[] = [
  { field: 'code', headerName: 'Code', width: 110 },
  { field: 'title', headerName: 'Title', flex: 1 },
  { field: 'durationDays', headerName: 'Days', width: 80 },
  { field: 'organiser', headerName: 'Organiser', flex: 1 },
  { field: 'certificateType', headerName: 'Cert.', width: 120 },
  { field: 'certificateValidMonths', headerName: 'Valid (mo)', width: 110 },
  { field: 'active', headerName: 'Active', width: 90, type: 'boolean' },
];

/** Course catalog admin (UR-TRM-007). */
export default function CoursesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState<CourseUpsert>({
    code: '',
    title: '',
    description: '',
    durationDays: 1,
    organiser: '',
    certificateType: '',
    certificateValidMonths: 0,
    active: true,
  });

  const load = () => api<any[]>('/trm/courses').then(setRows);
  useEffect(() => { load(); }, []);

  const save = async () => {
    await api('/trm/courses', { method: 'PUT', body: JSON.stringify(f) });
    setF({ ...f, code: '', title: '' });
    load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Course Catalog
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" label="Code" value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
          <TextField size="small" label="Title" sx={{ minWidth: 220 }} value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })} />
          <TextField size="small" type="number" label="Days" sx={{ width: 90 }}
            value={f.durationDays}
            onChange={(e) => setF({ ...f, durationDays: Number(e.target.value) })} />
          <TextField size="small" label="Organiser" value={f.organiser}
            onChange={(e) => setF({ ...f, organiser: e.target.value })} />
          <TextField size="small" label="Cert. type" value={f.certificateType}
            onChange={(e) => setF({ ...f, certificateType: e.target.value })} />
          <TextField size="small" type="number" label="Valid months" sx={{ width: 130 }}
            value={f.certificateValidMonths}
            onChange={(e) => setF({ ...f, certificateValidMonths: Number(e.target.value) })} />
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
