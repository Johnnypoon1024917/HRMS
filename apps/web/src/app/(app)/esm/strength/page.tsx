'use client';

import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '@/lib/api';

const cols: GridColDef[] = [
  { field: 'orgUnitName', headerName: 'Org Unit', flex: 1 },
  { field: 'rankCode', headerName: 'Rank', width: 100 },
  { field: 'establishment', headerName: 'Establishment', width: 140 },
  { field: 'strength', headerName: 'Strength', width: 120 },
  { field: 'vacancies', headerName: 'Vacancies', width: 120 },
];

/** Establishment & Strength figures from the daily snapshot (UR-ESM-002). */
export default function StrengthPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [date, setDate] = useState('');
  useEffect(() => {
    api<any[]>('/esm/strength').then((r) => {
      setRows(r);
      if (r[0]) setDate(r[0].snapshotDate);
    });
  }, []);
  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={1}>
        Establishment &amp; Strength
      </Typography>
      <Typography color="text.secondary" mb={2}>
        {date ? `Snapshot: ${date}` : 'No snapshot yet — run the ESM daily batch.'}
      </Typography>
      <div style={{ height: 540, width: '100%' }}>
        <DataGrid rows={rows.map((r, i) => ({ id: i, ...r }))} columns={cols}
          disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
