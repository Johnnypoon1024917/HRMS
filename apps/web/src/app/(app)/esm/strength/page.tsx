'use client';

import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { useNotify } from '@/components/feedback/Notify';

const cols: GridColDef[] = [
  { field: 'orgUnitName', headerName: 'Org Unit', flex: 1 },
  { field: 'rankCode', headerName: 'Rank', width: 100 },
  { field: 'establishment', headerName: 'Establishment', width: 140 },
  { field: 'strength', headerName: 'Strength', width: 120 },
  { field: 'vacancies', headerName: 'Vacancies', width: 120 },
];

/** Establishment & Strength figures from the daily snapshot (UR-ESM-002). */
export default function StrengthPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<any[]>([]);
  const [date, setDate] = useState('');
  useEffect(() => {
    api<any[]>('/esm/strength')
      .then((r) => {
        setRows(r);
        if (r[0]) setDate(r[0].snapshotDate);
      })
      .catch((e: any) => notify.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Box>
      <PageHeader
        title="Establishment & Strength"
        subtitle={date ? `Snapshot: ${date}` : 'No snapshot yet — run the ESM daily batch.'}
      />
      <div style={{ height: 540, width: '100%' }}>
        <DataGrid rows={rows.map((r, i) => ({ id: i, ...r }))} columns={cols}
          disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
