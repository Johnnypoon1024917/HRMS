'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { LeaveRequestView } from '@hrms/contracts';
import { api } from '@/lib/api';

export default function ApprovalsPage() {
  const [rows, setRows] = useState<LeaveRequestView[]>([]);

  const load = () => api<LeaveRequestView[]>('/lve/approvals').then(setRows);
  useEffect(() => { load(); }, []);

  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    await api(`/lve/approvals/${id}`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
    load();
  };

  const cols: GridColDef[] = [
    { field: 'staffNo', headerName: 'Staff', width: 110 },
    { field: 'leaveTypeCode', headerName: 'Type', width: 90 },
    { field: 'startDate', headerName: 'From', width: 120 },
    { field: 'endDate', headerName: 'To', width: 120 },
    { field: 'days', headerName: 'Days', width: 80 },
    { field: 'reason', headerName: 'Reason', flex: 1 },
    {
      field: 'actions',
      headerName: 'Decision',
      width: 200,
      sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="contained" color="success"
            onClick={() => decide(p.row.id, 'approved')}>
            Approve
          </Button>
          <Button size="small" variant="outlined" color="error"
            onClick={() => decide(p.row.id, 'rejected')}>
            Reject
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Leave Approvals
      </Typography>
      <Typography color="text.secondary" mb={2}>
        Pending requests within your team (data scope). You cannot approve your own.
      </Typography>
      <div style={{ height: 520, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
