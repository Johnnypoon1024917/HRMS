'use client';

import { useEffect, useState } from 'react';
import { Box, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useRouter } from 'next/navigation';
import type { TeamMember } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { useNotify } from '@/components/feedback/Notify';

export default function MyTeamPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<TeamMember[]>([]);
  const router = useRouter();

  useEffect(() => {
    api<TeamMember[]>('/ess/team')
      .then(setRows)
      .catch((e: any) => notify.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cols: GridColDef[] = [
    { field: 'staffNo', headerName: 'Staff', width: 110 },
    { field: 'nameEn', headerName: 'Name', flex: 1 },
    { field: 'rankCode', headerName: 'Rank', width: 100 },
    { field: 'orgUnitName', headerName: 'Unit', flex: 1 },
    {
      field: 'onLeaveToday',
      headerName: 'Today',
      width: 130,
      renderCell: (p) =>
        p.value ? (
          <Chip size="small" color="warning" label="On leave" />
        ) : (
          <Chip size="small" color="success" label="In" />
        ),
    },
    {
      field: 'pendingLeaveRequests',
      headerName: 'Pending',
      width: 120,
      renderCell: (p) =>
        p.value > 0 ? (
          <Chip
            size="small"
            color="error"
            label={`${p.value} to approve`}
            onClick={() => router.push('/lve/approvals')}
          />
        ) : (
          '—'
        ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="My Team"
        subtitle="Staff within your data scope. Pending counts link to leave approvals."
      />
      <div style={{ height: 540, width: '100%' }}>
        <DataGrid
          rows={rows.map((r) => ({ id: r.staffId, ...r }))}
          columns={cols}
          disableRowSelectionOnClick
        />
      </div>
    </Box>
  );
}
