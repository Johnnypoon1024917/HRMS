'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { AwardView } from '@hrms/contracts';
import { api } from '@/lib/api';

const cols: GridColDef[] = [
  { field: 'staffNo', headerName: 'Staff', width: 110 },
  { field: 'staffName', headerName: 'Name', flex: 1 },
  { field: 'awardTypeCode', headerName: 'Code', width: 110 },
  { field: 'awardTypeName', headerName: 'Award', flex: 1 },
  { field: 'kind', headerName: 'Kind', width: 120 },
  { field: 'awardedOn', headerName: 'Date', width: 130 },
  { field: 'citation', headerName: 'Citation', flex: 1 },
];

export default function AwardsPage() {
  const [rows, setRows] = useState<AwardView[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [f, setF] = useState({
    staffId: '',
    awardTypeCode: '',
    awardedOn: new Date().toISOString().slice(0, 10),
    citation: '',
  });

  const load = async () => {
    setRows(await api<AwardView[]>('/ham/awards'));
    setTypes(await api<any[]>('/ham/types'));
  };
  useEffect(() => { load(); }, []);

  const grant = async () => {
    setErr('');
    setMsg('');
    try {
      await api('/ham/awards', { method: 'POST', body: JSON.stringify(f) });
      setMsg('Award granted.');
      setF({ ...f, staffId: '', citation: '' });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Awards
      </Typography>
      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField size="small" label="Staff ID" value={f.staffId}
            onChange={(e) => setF({ ...f, staffId: e.target.value })} />
          <TextField select size="small" label="Award" sx={{ minWidth: 220 }}
            value={f.awardTypeCode}
            onChange={(e) => setF({ ...f, awardTypeCode: e.target.value })}>
            {types.map((t) => (
              <MenuItem key={t.code} value={t.code}>{t.nameEn}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" type="date" label="Date"
            InputLabelProps={{ shrink: true }} value={f.awardedOn}
            onChange={(e) => setF({ ...f, awardedOn: e.target.value })} />
          <TextField size="small" label="Citation" sx={{ flexGrow: 1 }}
            value={f.citation}
            onChange={(e) => setF({ ...f, citation: e.target.value })} />
          <Button variant="contained" onClick={grant}
            disabled={!f.staffId || !f.awardTypeCode}>
            Grant
          </Button>
        </Stack>
      </Paper>

      <div style={{ height: 500, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
