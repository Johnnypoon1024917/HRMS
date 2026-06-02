'use client';

import { useEffect, useState } from 'react';
import { Box, Button } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { LsiCandidate } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { useNotify } from '@/components/feedback/Notify';

/** Long Service Increment candidates (UR-HAM-003). */
export default function LsiPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<LsiCandidate[]>([]);

  const load = async () => {
    try {
      setRows(await api<LsiCandidate[]>('/ham/lsi'));
    } catch (e: any) {
      notify.error(e.message);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const grant = async (c: LsiCandidate) => {
    try {
      await api('/ham/awards', {
        method: 'POST',
        body: JSON.stringify({
          staffId: c.staffId,
          awardTypeCode: c.awardTypeCode,
          awardedOn: new Date().toISOString().slice(0, 10),
          citation: `Long Service Increment — ${c.thresholdYears} years`,
        }),
      });
      notify.success(`Granted ${c.awardTypeCode} to ${c.staffName}.`);
      load();
    } catch (e: any) {
      notify.error(e.message);
    }
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
      <PageHeader
        title="LSI Candidates"
        subtitle="Staff who have crossed an LSI threshold and have not yet received it."
      />
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
