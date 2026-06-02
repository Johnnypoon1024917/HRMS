'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { Paged, StaffListItem } from '@hrms/contracts';
import { api } from '@/lib/api';
import { Sym } from '@/components/Sym';

const columns: GridColDef[] = [
  { field: 'staffNo', headerName: 'Staff No.', width: 120 },
  { field: 'nameEn', headerName: 'Name (EN)', flex: 1 },
  { field: 'nameZh', headerName: '姓名', flex: 1 },
  { field: 'rankCode', headerName: 'Rank', width: 100 },
  { field: 'orgUnitName', headerName: 'Unit', flex: 1 },
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    renderCell: (p) => (
      <Chip
        size="small"
        label={p.value}
        color={p.value === 'active' ? 'success' : 'default'}
      />
    ),
  },
];

/** Personnel search (UR-GEN-003): multi-criteria AND, server-paginated. */
export default function StaffPage() {
  const [name, setName] = useState('');
  const [staffNo, setStaffNo] = useState('');
  const [rows, setRows] = useState<StaffListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({
      page: String(page + 1),
      pageSize: '25',
      ...(name ? { name } : {}),
      ...(staffNo ? { staffNo } : {}),
    });
    api<Paged<StaffListItem>>(`/pim/staff?${qs}`)
      .then((r) => {
        setRows(r.items);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Personnel
      </Typography>
      <Stack direction="row" spacing={2} mb={2}>
        <TextField
          size="small" label="Name" value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          size="small" label="Staff No." value={staffNo}
          onChange={(e) => setStaffNo(e.target.value)}
        />
        <Button variant="contained" startIcon={<Sym name="search" size={18} />} onClick={() => { setPage(0); load(); }}>
          Search
        </Button>
      </Stack>
      <div style={{ height: 560, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          paginationMode="server"
          rowCount={total}
          paginationModel={{ page, pageSize: 25 }}
          onPaginationModelChange={(m) => setPage(m.page)}
          pageSizeOptions={[25]}
          disableRowSelectionOnClick
        />
      </div>
    </Box>
  );
}
