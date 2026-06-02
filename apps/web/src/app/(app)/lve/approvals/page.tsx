'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Stack } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { LeaveRequestView } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { useNotify } from '@/components/feedback/Notify';

export default function ApprovalsPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<LeaveRequestView[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<LeaveRequestView[]>('/lve/approvals'));
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    try {
      await api(`/lve/approvals/${id}`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      notify.success(decision === 'approved' ? 'Request approved' : 'Request rejected');
      load();
    } catch (e: any) {
      notify.error(e.message);
    }
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
      <PageHeader
        title="Leave Approvals"
        subtitle="Pending requests within your team (data scope). You cannot approve your own."
      />
      <div style={{ height: 520, width: '100%' }}>
        <DataGrid rows={rows} loading={loading} columns={cols} disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
