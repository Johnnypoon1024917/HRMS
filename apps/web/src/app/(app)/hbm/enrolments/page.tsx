'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { BenefitView } from '@hrms/contracts';
import { api } from '@/lib/api';

const cols: GridColDef[] = [
  { field: 'staffNo', headerName: 'Staff', width: 110 },
  { field: 'staffName', headerName: 'Name', flex: 1 },
  { field: 'benefitTypeName', headerName: 'Benefit', flex: 1 },
  { field: 'category', headerName: 'Category', width: 130 },
  {
    field: 'chargeable', headerName: 'Charged', width: 100,
    renderCell: (p) => p.value ? <Chip size="small" color="warning" label="bill" /> : '—',
  },
  { field: 'monthlyAmount', headerName: 'Monthly', width: 110 },
  { field: 'effectiveFrom', headerName: 'From', width: 120 },
  { field: 'effectiveTo', headerName: 'To', width: 120 },
];

export default function BenefitEnrolmentsPage() {
  const [rows, setRows] = useState<BenefitView[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [f, setF] = useState({
    staffId: '',
    benefitTypeCode: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    monthlyAmount: 0,
  });

  const load = async () => {
    setRows(await api<BenefitView[]>('/hbm/enrolments'));
    setTypes(await api<any[]>('/hbm/types'));
  };
  useEffect(() => { load(); }, []);

  const enrol = async () => {
    setErr('');
    try {
      await api('/hbm/enrolments', {
        method: 'POST',
        body: JSON.stringify({
          ...f,
          monthlyAmount: f.monthlyAmount || undefined,
        }),
      });
      setMsg('Enrolled.');
      setF({ ...f, staffId: '' });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const terminate = async (id: string) => {
    const date = prompt('End date (YYYY-MM-DD)?', new Date().toISOString().slice(0, 10));
    if (!date) return;
    await api(`/hbm/enrolments/${id}/terminate`, {
      method: 'POST', body: JSON.stringify({ effectiveTo: date }),
    });
    load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Benefit Enrolments
      </Typography>
      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" label="Staff ID" value={f.staffId}
            onChange={(e) => setF({ ...f, staffId: e.target.value })} />
          <TextField select size="small" label="Benefit" sx={{ minWidth: 200 }}
            value={f.benefitTypeCode}
            onChange={(e) => setF({ ...f, benefitTypeCode: e.target.value })}>
            {types.map((t) => (
              <MenuItem key={t.code} value={t.code}>{t.nameEn}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" type="date" label="Effective from"
            InputLabelProps={{ shrink: true }} value={f.effectiveFrom}
            onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} />
          <TextField size="small" type="number" label="Monthly (override)" sx={{ width: 170 }}
            value={f.monthlyAmount}
            onChange={(e) => setF({ ...f, monthlyAmount: Number(e.target.value) })} />
          <Button variant="contained" onClick={enrol}
            disabled={!f.staffId || !f.benefitTypeCode}>
            Enrol
          </Button>
        </Stack>
      </Paper>

      <div style={{ height: 480, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={[
            ...cols,
            {
              field: 'actions', headerName: '', width: 130, sortable: false,
              renderCell: (p) =>
                p.row.effectiveTo ? null : (
                  <Button size="small" color="error" onClick={() => terminate(p.row.id)}>
                    End
                  </Button>
                ),
            },
          ]}
          disableRowSelectionOnClick
        />
      </div>
    </Box>
  );
}
