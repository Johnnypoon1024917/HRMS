'use client';

import { useEffect, useState } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '@/lib/api';

const cols: GridColDef[] = [
  { field: 'title', headerName: 'Post', flex: 1 },
  { field: 'rankCode', headerName: 'Rank', width: 100 },
  {
    field: 'orgUnit',
    headerName: 'Org Unit',
    flex: 1,
    valueGetter: (_: any, row: any) => row.orgUnit?.nameEn,
  },
  { field: 'establishmentType', headerName: 'Type', width: 120 },
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    renderCell: (p) => (
      <Chip
        size="small"
        label={p.value}
        color={p.value === 'filled' ? 'success' : p.value === 'frozen' ? 'default' : 'warning'}
      />
    ),
  },
];

export default function PostsPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    api<any[]>('/esm/posts').then(setRows);
  }, []);
  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Establishment — Posts
      </Typography>
      <div style={{ height: 560, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
