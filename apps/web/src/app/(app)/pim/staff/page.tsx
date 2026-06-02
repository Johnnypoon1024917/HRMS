'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Chip,
  Paper,
  Stack,
  TextField,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { Paged, StaffListItem } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

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

/** Personnel search (UR-GEN-003): multi-criteria AND, server-paginated.
 *  Rows link to the entity-centric Employee Profile (Principle 1). */
export default function StaffPage() {
  const router = useRouter();
  // `input` updates on every keystroke; `query` is the debounced value that
  // actually drives the server fetch. Keeping them separate means typing no
  // longer fires a request (or reloads the grid) on each character.
  const [input, setInput] = useState({ name: '', staffNo: '' });
  const [query, setQuery] = useState({ name: '', staffNo: '' });
  const [rows, setRows] = useState<StaffListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  // Debounce input → query, resetting to the first page on a new search.
  useEffect(() => {
    const h = setTimeout(() => {
      setQuery(input);
      setPage(0);
    }, 300);
    return () => clearTimeout(h);
  }, [input]);

  // The single source of truth for fetching: committed query + page. Replaces
  // the old eslint-disabled effect whose `load()` closed over stale state.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const qs = new URLSearchParams({
      page: String(page + 1),
      pageSize: '25',
      ...(query.name ? { name: query.name } : {}),
      ...(query.staffNo ? { staffNo: query.staffNo } : {}),
    });
    api<Paged<StaffListItem>>(`/pim/staff?${qs}`)
      .then((r) => {
        if (!active) return;
        setRows(r.items);
        setTotal(r.total);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [page, query]);

  // Memoised so re-renders triggered by the search inputs don't re-render the
  // (expensive) grid — only row/page/loading changes rebuild it.
  const grid = useMemo(
    () => (
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        paginationMode="server"
        rowCount={total}
        paginationModel={{ page, pageSize: 25 }}
        onPaginationModelChange={(m) => setPage(m.page)}
        pageSizeOptions={[25]}
        onRowClick={(p) => router.push(`/pim/staff/${p.id}`)}
        sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
      />
    ),
    [rows, total, page, loading, router],
  );

  return (
    <Box>
      <PageHeader
        title="Personnel"
        subtitle="Search staff, then open a profile to view or edit."
      />
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            size="small" label="Name" value={input.name}
            onChange={(e) => setInput((s) => ({ ...s, name: e.target.value }))}
          />
          <TextField
            size="small" label="Staff No." value={input.staffNo}
            onChange={(e) => setInput((s) => ({ ...s, staffNo: e.target.value }))}
          />
        </Stack>
      </Paper>
      <div style={{ height: 560, width: '100%' }}>{grid}</div>
    </Box>
  );
}
