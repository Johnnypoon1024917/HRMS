'use client';

import { useEffect, useState } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useRouter } from 'next/navigation';
import type { TeamMember } from '@hrms/contracts';
import { api } from '@/lib/api';

export default function MyTeamPage() {
  const [rows, setRows] = useState<TeamMember[]>([]);
  const router = useRouter();

  useEffect(() => {
    api<TeamMember[]>('/ess/team').then(setRows);
  }, []);

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
      <Typography variant="h5" fontWeight={600} mb={1}>
        My Team
      </Typography>
      <Typography color="text.secondary" mb={2}>
        Staff within your data scope. Pending counts link to leave approvals.
      </Typography>
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
