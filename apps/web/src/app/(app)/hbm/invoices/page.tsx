'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Chip, Paper, Stack, TextField } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { InvoiceView } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { useNotify } from '@/components/feedback/Notify';

const statusColor = (s: string) =>
  s === 'paid' ? 'success' : s === 'overdue' ? 'error' : s === 'cancelled' ? 'default' : 'warning';

export default function InvoicesPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<InvoiceView[]>([]);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));

  const load = async () => {
    try {
      setRows(await api<InvoiceView[]>(`/hbm/invoices?period=${period}`));
    } catch (e: any) {
      notify.error(e.message);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async () => {
    try {
      const r = await api<{ invoices: number }>('/hbm/invoices/generate', {
        method: 'POST', body: JSON.stringify({ period }),
      });
      notify.success(`Generated ${r.invoices} invoice(s) for ${period}.`);
      load();
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  const pay = async (id: string) => {
    try {
      await api(`/hbm/invoices/${id}/paid`, { method: 'POST' });
      notify.success('Invoice marked paid');
      load();
    } catch (e: any) {
      notify.error(e.message);
    }
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
      <PageHeader
        title="Benefit Invoices"
        primary={{ label: 'Generate invoices', icon: 'receipt_long', onClick: generate }}
        secondary={[{ label: 'Refresh', icon: 'refresh', onClick: load }]}
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField size="small" label="Period (YYYY-MM)" value={period}
            onChange={(e) => setPeriod(e.target.value)} />
          <Button variant="outlined" onClick={load}>Apply</Button>
        </Stack>
      </Paper>

      <div style={{ height: 480, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
