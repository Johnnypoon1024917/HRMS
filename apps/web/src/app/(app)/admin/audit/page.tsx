'use client';

import { useEffect, useState } from 'react';
import { Box, TextField } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { useNotify } from '@/components/feedback/Notify';

const cols: GridColDef[] = [
  {
    field: 'at',
    headerName: 'When',
    width: 180,
    valueFormatter: (v: any) => new Date(v as string).toLocaleString(),
  },
  { field: 'userId', headerName: 'User', width: 200 },
  { field: 'action', headerName: 'Action', width: 100 },
  { field: 'entity', headerName: 'Entity', width: 140 },
  { field: 'entityId', headerName: 'Entity ID', width: 200 },
  { field: 'ip', headerName: 'IP', width: 130 },
];

/** Append-only audit log viewer (REQ-SEC-001). */
export default function AuditPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<any[]>([]);
  const [entity, setEntity] = useState('');

  const load = async () => {
    try {
      setRows(await api<any[]>(`/audit${entity ? `?entity=${entity}` : ''}`));
    } catch (e: any) {
      notify.error(e.message);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box>
      <PageHeader
        title="Audit Log"
        primary={{ label: 'Search', icon: 'search', onClick: load }}
      />
      <TextField
        size="small" label="Filter by entity" value={entity} sx={{ mb: 2 }}
        onChange={(e) => setEntity(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && load()}
      />
      <div style={{ height: 560, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
