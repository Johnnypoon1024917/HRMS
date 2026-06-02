'use client';

import { useEffect, useState } from 'react';
import { Box, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { ActingRecord } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { useNotify } from '@/components/feedback/Notify';

const cols: GridColDef[] = [
  { field: 'staffNo', headerName: 'Staff', width: 110 },
  { field: 'nameEn', headerName: 'Name', flex: 1 },
  { field: 'actingRank', headerName: 'Acting Rank', width: 130 },
  { field: 'postTitle', headerName: 'Post', flex: 1 },
  { field: 'effectiveFrom', headerName: 'From', width: 120 },
  { field: 'effectiveTo', headerName: 'Until', width: 120 },
  {
    field: 'endingSoon',
    headerName: 'Status',
    width: 150,
    renderCell: (p) =>
      p.value ? (
        <Chip size="small" color="warning" label="Ending ≤14d" />
      ) : (
        <Chip size="small" color="success" label="Active" />
      ),
  },
];

/** Staff currently acting (UR-POM-002); ending-soon flags for follow-up. */
export default function ActingPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<ActingRecord[]>([]);
  useEffect(() => {
    api<ActingRecord[]>('/pom/acting')
      .then(setRows)
      .catch((e: any) => notify.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Box>
      <PageHeader title="Acting Appointments" />
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
