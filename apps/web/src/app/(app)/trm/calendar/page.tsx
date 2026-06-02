'use client';

import { useEffect, useState } from 'react';
import { Box, Stack, TextField, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { CalendarEntry } from '@hrms/contracts';
import { api } from '@/lib/api';

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
  const today = new Date().toISOString().slice(0, 10);
  const monthOut = new Date(Date.now() + 90 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(monthOut);
  const [rows, setRows] = useState<CalendarEntry[]>([]);

  const load = () =>
    api<CalendarEntry[]>(`/trm/calendar?from=${from}&to=${to}`).then(setRows);
  useEffect(() => { load(); }, []); // eslint-disable-line

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Training Calendar
      </Typography>
      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <TextField size="small" type="date" label="From"
          InputLabelProps={{ shrink: true }} value={from}
          onChange={(e) => setFrom(e.target.value)} />
        <TextField size="small" type="date" label="To"
          InputLabelProps={{ shrink: true }} value={to}
          onChange={(e) => setTo(e.target.value)} />
        <Box>
          <button onClick={load} style={{ padding: '6px 12px' }}>Refresh</button>
        </Box>
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
