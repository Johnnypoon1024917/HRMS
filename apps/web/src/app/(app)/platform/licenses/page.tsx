'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';
import { useDialogs } from '@/components/feedback/Confirm';

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

const emptyForm = { tenantId: '', months: 12, maxSeats: 0, modules: '' };

/** Operator-issued license keys for on-prem deployments. */
export default function LicensesAdmin() {
  const notify = useNotify();
  const { confirm } = useDialogs();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(emptyForm);
  const [issued, setIssued] = useState<{ jwt: string; expiresAt: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<any[]>('/bil/licenses'));
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDrawer = () => { setF(emptyForm); setOpen(true); };

  const issue = async () => {
    setSaving(true);
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
      notify.success('License issued');
      setOpen(false);
      load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id: string) => {
    const ok = await confirm({
      title: 'Revoke license',
      message: 'This will immediately invalidate the license key. Continue?',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api(`/bil/licenses/${id}/revoke`, { method: 'POST' });
      notify.success('License revoked');
      load();
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title="On-prem License Keys (operator)"
        primary={{ label: 'Issue license', icon: 'add', onClick: openDrawer }}
      />

      {issued && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setIssued(null)}>
          <Typography variant="body2" gutterBottom>
            New license — expires {new Date(issued.expiresAt).toLocaleString()}. Copy this
            JWT into the customer&apos;s <code>LICENSE_KEY</code> env var:
          </Typography>
          <TextField fullWidth multiline minRows={3} value={issued.jwt}
            InputProps={{ readOnly: true, style: { fontFamily: 'monospace', fontSize: 12 } }} />
        </Alert>
      )}

      <div style={{ height: 480, width: '100%' }}>
        <DataGrid
          rows={rows}
          loading={loading}
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

      <CrudDrawer
        open={open}
        title="Issue on-prem license"
        subtitle="Generate a signed license key for a tenant deployment"
        onClose={() => setOpen(false)}
        onSubmit={issue}
        submitLabel="Issue"
        submitting={saving}
        submitDisabled={!f.tenantId}
      >
        <TextField label="Tenant ID" value={f.tenantId} required
          onChange={(e) => setF({ ...f, tenantId: e.target.value })} />
        <TextField type="number" label="Months" value={f.months}
          onChange={(e) => setF({ ...f, months: Number(e.target.value) })} />
        <TextField type="number" label="Max seats (0 = plan default)" value={f.maxSeats}
          onChange={(e) => setF({ ...f, maxSeats: Number(e.target.value) })} />
        <TextField label="Modules (blank = plan default)" value={f.modules}
          helperText="Comma-separated module codes"
          onChange={(e) => setF({ ...f, modules: e.target.value })} />
      </CrudDrawer>
    </Box>
  );
}
