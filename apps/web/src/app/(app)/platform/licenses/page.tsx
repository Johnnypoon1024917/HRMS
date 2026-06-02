'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '@/lib/api';

const cols: GridColDef[] = [
  { field: 'tenantSlug', headerName: 'Tenant', width: 140 },
  {
    field: 'modules', headerName: 'Modules', flex: 1,
    valueGetter: (v: any) => (Array.isArray(v) ? v.join(', ') : ''),
  },
  { field: 'maxSeats', headerName: 'Max seats', width: 110 },
  {
    field: 'expiresAt', headerName: 'Expires', width: 160,
    valueFormatter: (v: any) => new Date(v as string).toLocaleDateString(),
  },
  {
    field: 'revokedAt', headerName: 'Status', width: 110,
    renderCell: (p) =>
      p.value ? <Chip size="small" color="error" label="revoked" />
              : <Chip size="small" color="success" label="active" />,
  },
];

/** Operator-issued license keys for on-prem deployments. */
export default function LicensesAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ tenantId: '', months: 12, maxSeats: 0, modules: '' });
  const [issued, setIssued] = useState<{ jwt: string; expiresAt: string } | null>(null);
  const [err, setErr] = useState('');

  const load = () => api<any[]>('/bil/licenses').then(setRows);
  useEffect(() => { load(); }, []);

  const issue = async () => {
    setErr('');
    try {
      const r = await api<{ jwt: string; expiresAt: string }>('/bil/licenses', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: f.tenantId,
          months: f.months,
          maxSeats: f.maxSeats || undefined,
          modules: f.modules
            ? f.modules.split(',').map((m) => m.trim()).filter(Boolean)
            : undefined,
        }),
      });
      setIssued(r);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const revoke = async (id: string) => {
    await api(`/bil/licenses/${id}/revoke`, { method: 'POST' });
    load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        On-prem License Keys (operator)
      </Typography>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
          <TextField size="small" label="Tenant ID" sx={{ minWidth: 220 }} value={f.tenantId}
            onChange={(e) => setF({ ...f, tenantId: e.target.value })} />
          <TextField size="small" type="number" label="Months" sx={{ width: 110 }}
            value={f.months}
            onChange={(e) => setF({ ...f, months: Number(e.target.value) })} />
          <TextField size="small" type="number" label="Max seats (0 = plan default)"
            sx={{ width: 220 }} value={f.maxSeats}
            onChange={(e) => setF({ ...f, maxSeats: Number(e.target.value) })} />
          <TextField size="small" label="Modules (blank = plan default)"
            sx={{ minWidth: 260, flexGrow: 1 }}
            value={f.modules} onChange={(e) => setF({ ...f, modules: e.target.value })} />
          <Button variant="contained" onClick={issue} disabled={!f.tenantId}>
            Issue
          </Button>
        </Stack>
      </Paper>

      {issued && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            New license — expires {new Date(issued.expiresAt).toLocaleString()}. Copy this
            JWT into the customer's <code>LICENSE_KEY</code> env var:
          </Typography>
          <TextField fullWidth multiline minRows={3} value={issued.jwt}
            InputProps={{ readOnly: true, style: { fontFamily: 'monospace', fontSize: 12 } }} />
        </Alert>
      )}

      <div style={{ height: 480, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={[
            ...cols,
            {
              field: 'actions', headerName: '', width: 110, sortable: false,
              renderCell: (p) =>
                p.row.revokedAt ? null : (
                  <Button size="small" color="error" onClick={() => revoke(p.row.id)}>
                    Revoke
                  </Button>
                ),
            },
          ]}
          disableRowSelectionOnClick
        />
      </div>
    </Box>
  );
}
