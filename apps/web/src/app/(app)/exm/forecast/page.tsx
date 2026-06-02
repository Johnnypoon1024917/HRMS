'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { ExitForecastRow } from '@hrms/contracts';
import { api } from '@/lib/api';

/** Promotion planning forecast (UR-EXM-004): upcoming exits + current posts. */
export default function ForecastPage() {
  const [rows, setRows] = useState<ExitForecastRow[]>([]);
  const [days, setDays] = useState(365);

  const load = () =>
    api<ExitForecastRow[]>(`/exm/forecast?windowDays=${days}`).then(setRows);
  useEffect(() => { load(); }, []); // eslint-disable-line

  const cols: GridColDef[] = [
    { field: 'staffNo', headerName: 'Staff', width: 110 },
    { field: 'staffName', headerName: 'Name', flex: 1 },
    { field: 'rankCode', headerName: 'Rank', width: 100 },
    { field: 'orgUnitName', headerName: 'Unit', flex: 1 },
    { field: 'reason', headerName: 'Reason', width: 170 },
    { field: 'effectiveDate', headerName: 'Effective', width: 130 },
    {
      field: 'daysUntil',
      headerName: 'In',
      width: 100,
      renderCell: (p) => (
        <Chip
          size="small"
          color={p.value <= 30 ? 'error' : p.value <= 90 ? 'warning' : 'default'}
          label={`${p.value}d`}
        />
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Exit Forecast
      </Typography>
      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <TextField size="small" type="number" label="Window (days)" sx={{ width: 150 }}
          value={days} onChange={(e) => setDays(Number(e.target.value))} />
        <button onClick={load} style={{ padding: '6px 12px' }}>Refresh</button>
      </Stack>
      <div style={{ height: 540, width: '100%' }}>
        <DataGrid
          rows={rows.map((r) => ({ id: r.staffId + r.effectiveDate, ...r }))}
          columns={cols}
          disableRowSelectionOnClick
        />
      </div>
    </Box>
  );
}
