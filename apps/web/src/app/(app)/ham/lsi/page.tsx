'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { LsiCandidate } from '@hrms/contracts';
import { api } from '@/lib/api';

/** Long Service Increment candidates (UR-HAM-003). */
export default function LsiPage() {
  const [rows, setRows] = useState<LsiCandidate[]>([]);
  const [msg, setMsg] = useState('');

  const load = () => api<LsiCandidate[]>('/ham/lsi').then(setRows);
  useEffect(() => { load(); }, []);

  const grant = async (c: LsiCandidate) => {
    await api('/ham/awards', {
      method: 'POST',
      body: JSON.stringify({
        staffId: c.staffId,
        awardTypeCode: c.awardTypeCode,
        awardedOn: new Date().toISOString().slice(0, 10),
        citation: `Long Service Increment — ${c.thresholdYears} years`,
      }),
    });
    setMsg(`Granted ${c.awardTypeCode} to ${c.staffName}.`);
    load();
  };

  const cols: GridColDef[] = [
    { field: 'staffNo', headerName: 'Staff', width: 110 },
    { field: 'staffName', headerName: 'Name', flex: 1 },
    { field: 'yearsOfService', headerName: 'Years', width: 90 },
    { field: 'thresholdYears', headerName: 'Threshold', width: 110 },
    { field: 'awardTypeCode', headerName: 'Award', width: 130 },
    {
      field: 'actions',
      headerName: '',
      width: 130,
      sortable: false,
      renderCell: (p) => (
        <Button size="small" variant="contained" onClick={() => grant(p.row)}>
          Grant
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={1}>
        LSI Candidates
      </Typography>
      <Typography color="text.secondary" mb={2}>
        Staff who have crossed an LSI threshold and have not yet received it.
      </Typography>
      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}
      <div style={{ height: 520, width: '100%' }}>
        <DataGrid
          rows={rows.map((r, i) => ({ id: i, ...r }))}
          columns={cols}
          disableRowSelectionOnClick
        />
      </div>
    </Box>
  );
}
