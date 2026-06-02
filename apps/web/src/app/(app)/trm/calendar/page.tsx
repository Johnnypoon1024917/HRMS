'use client';

import { useEffect, useState } from 'react';
import { Box, Stack, TextField } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { CalendarEntry } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { useNotify } from '@/components/feedback/Notify';

const cols: GridColDef[] = [
  { field: 'courseCode', headerName: 'Code', width: 110 },
  { field: 'courseTitle', headerName: 'Course', flex: 1 },
  { field: 'startDate', headerName: 'Start', width: 120 },
  { field: 'endDate', headerName: 'End', width: 120 },
  { field: 'location', headerName: 'Location', flex: 1 },
  {
    field: 'enrolled',
    headerName: 'Enrolled',
    width: 130,
    valueGetter: (_: any, row: any) => `${row.enrolled} / ${row.capacity}`,
  },
];

/** Training calendar (UR-TRM-004). */
export default function CalendarPage() {
  const notify = useNotify();
  const today = new Date().toISOString().slice(0, 10);
  const monthOut = new Date(Date.now() + 90 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(monthOut);
  const [rows, setRows] = useState<CalendarEntry[]>([]);

  const load = async () => {
    try {
      setRows(await api<CalendarEntry[]>(`/trm/calendar?from=${from}&to=${to}`));
    } catch (e: any) {
      notify.error(e.message);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box>
      <PageHeader
        title="Training Calendar"
        primary={{ label: 'Refresh', icon: 'refresh', onClick: load }}
      />

      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <TextField size="small" type="date" label="From"
          InputLabelProps={{ shrink: true }} value={from}
          onChange={(e) => setFrom(e.target.value)} />
        <TextField size="small" type="date" label="To"
          InputLabelProps={{ shrink: true }} value={to}
          onChange={(e) => setTo(e.target.value)} />
      </Stack>

      <div style={{ height: 540, width: '100%' }}>
        <DataGrid
          rows={rows.map((r) => ({ id: r.sessionId, ...r }))}
          columns={cols}
          disableRowSelectionOnClick
        />
      </div>
    </Box>
  );
}
