'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { InvoiceView } from '@hrms/contracts';
import { api } from '@/lib/api';

const statusColor = (s: string) =>
  s === 'paid' ? 'success' : s === 'overdue' ? 'error' : s === 'cancelled' ? 'default' : 'warning';

export default function InvoicesPage() {
  const [rows, setRows] = useState<InvoiceView[]>([]);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [msg, setMsg] = useState('');

  const load = () => api<InvoiceView[]>(`/hbm/invoices?period=${period}`).then(setRows);
  useEffect(() => { load(); }, []); // eslint-disable-line

  const generate = async () => {
    const r = await api<{ invoices: number }>('/hbm/invoices/generate', {
      method: 'POST', body: JSON.stringify({ period }),
    });
    setMsg(`Generated ${r.invoices} invoice(s) for ${period}.`);
    load();
  };

  const pay = async (id: string) => {
    await api(`/hbm/invoices/${id}/paid`, { method: 'POST' });
    load();
  };

  const cols: GridColDef[] = [
    { field: 'staffNo', headerName: 'Staff', width: 110 },
    { field: 'staffName', headerName: 'Name', flex: 1 },
    { field: 'period', headerName: 'Period', width: 110 },
    { field: 'total', headerName: 'Total', width: 110 },
    { field: 'dueDate', headerName: 'Due', width: 130 },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: (p) => <Chip size="small" label={p.value} color={statusColor(p.value) as any} />,
    },
    {
      field: 'actions', headerName: '', width: 110, sortable: false,
      renderCell: (p) =>
        p.row.status === 'open' ? (
          <Button size="small" variant="outlined" onClick={() => pay(p.row.id)}>
            Mark paid
          </Button>
        ) : null,
    },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Benefit Invoices
      </Typography>
      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField size="small" label="Period (YYYY-MM)" value={period}
            onChange={(e) => setPeriod(e.target.value)} />
          <Button variant="outlined" onClick={load}>Refresh</Button>
          <Button variant="contained" onClick={generate}>Generate invoices</Button>
        </Stack>
      </Paper>

      <div style={{ height: 480, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
