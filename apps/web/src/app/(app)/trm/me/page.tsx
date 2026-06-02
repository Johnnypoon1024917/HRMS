'use client';

import { useEffect, useState } from 'react';
import { Box, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { MyTrainingEntry } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { useNotify } from '@/components/feedback/Notify';

const statusColor = (s: string) =>
  s === 'attended'
    ? 'success'
    : s === 'failed'
      ? 'error'
      : s === 'absent'
        ? 'warning'
        : 'default';

const cols: GridColDef[] = [
  { field: 'courseCode', headerName: 'Code', width: 110 },
  { field: 'courseTitle', headerName: 'Course', flex: 1 },
  { field: 'startDate', headerName: 'Start', width: 120 },
  { field: 'endDate', headerName: 'End', width: 120 },
  {
    field: 'status',
    headerName: 'Status',
    width: 130,
    renderCell: (p) => (
      <Chip size="small" label={p.value} color={statusColor(p.value) as any} />
    ),
  },
  { field: 'score', headerName: 'Score', width: 90 },
  { field: 'certificateValidUntil', headerName: 'Cert until', width: 130 },
];

export default function MyTrainingPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<MyTrainingEntry[]>([]);
  useEffect(() => {
    api<MyTrainingEntry[]>('/trm/me')
      .then(setRows)
      .catch((e: any) => notify.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Box>
      <PageHeader title="My Training" />
      <div style={{ height: 540, width: '100%' }}>
        <DataGrid
          rows={rows.map((r) => ({ id: r.enrolmentId, ...r }))}
          columns={cols}
          disableRowSelectionOnClick
        />
      </div>
    </Box>
  );
}
