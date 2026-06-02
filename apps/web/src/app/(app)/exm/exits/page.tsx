'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Chip, MenuItem, TextField } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { ExitView } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { StaffPicker } from '@/components/inputs/StaffPicker';
import { useNotify } from '@/components/feedback/Notify';
import { useDialogs } from '@/components/feedback/Confirm';

const REASONS = [
  'retirement', 'compulsory_retirement', 'dismissal', 'invaliding',
  'resignation', 'death', 'end_of_contract', 'posting_out',
  'reversion', 'termination',
];

const cols: GridColDef[] = [
  { field: 'staffNo', headerName: 'Staff', width: 110 },
  { field: 'staffName', headerName: 'Name', flex: 1 },
  { field: 'reason', headerName: 'Reason', width: 170 },
  { field: 'effectiveDate', headerName: 'Effective', width: 130 },
  {
    field: 'status', headerName: 'Status', width: 130,
    renderCell: (p) => (
      <Chip size="small" label={p.value}
        color={p.value === 'applied' ? 'success' : p.value === 'cancelled' ? 'default' : 'warning'} />
    ),
  },
];

const emptyForm = {
  staffId: '',
  reason: 'retirement',
  effectiveDate: '',
  interviewNotes: '',
};

/** Exit / offboarding records (UR-EXM-002): pending → applied via batch. */
export default function ExitsPage() {
  const notify = useNotify();
  const { confirm } = useDialogs();
  const [rows, setRows] = useState<ExitView[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<ExitView[]>('/exm/exits'));
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDrawer = () => { setF(emptyForm); setOpen(true); };

  const create = async () => {
    setSaving(true);
    try {
      await api('/exm/exits', { method: 'POST', body: JSON.stringify(f) });
      notify.success('Exit record queued.');
      setOpen(false);
      load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const runBatch = async () => {
    try {
      const r = await api<{ processed: number }>('/exm/batch/run', { method: 'POST' });
      notify.success(`Applied ${r.processed} exit(s).`);
      load();
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  const cancel = async (id: string) => {
    const ok = await confirm({
      title: 'Cancel exit record',
      message: 'This pending exit record will be cancelled.',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api(`/exm/exits/${id}/cancel`, { method: 'POST' });
      notify.success('Exit record cancelled.');
      load();
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Exit Records"
        primary={{ label: 'Queue exit', icon: 'add', onClick: openDrawer }}
        secondary={[{ label: 'Run daily batch', icon: 'play_arrow', onClick: runBatch }]}
      />

      <div style={{ height: 480, width: '100%' }}>
        <DataGrid
          rows={rows}
          loading={loading}
          columns={[
            ...cols,
            {
              field: 'actions', headerName: '', width: 110, sortable: false,
              renderCell: (p) =>
                p.row.status === 'pending' ? (
                  <Button size="small" color="error" onClick={() => cancel(p.row.id)}>
                    Cancel
                  </Button>
                ) : null,
            },
          ]}
          disableRowSelectionOnClick
        />
      </div>

      <CrudDrawer
        open={open}
        title="Queue exit record"
        onClose={() => setOpen(false)}
        onSubmit={create}
        submitLabel="Queue"
        submitting={saving}
        submitDisabled={!f.staffId || !f.effectiveDate}
      >
        <StaffPicker
          value={f.staffId || null}
          onChange={(id) => setF({ ...f, staffId: id ?? '' })}
          required
        />
        <TextField select label="Reason" value={f.reason}
          onChange={(e) => setF({ ...f, reason: e.target.value })}>
          {REASONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField type="date" label="Effective date" InputLabelProps={{ shrink: true }}
          value={f.effectiveDate}
          onChange={(e) => setF({ ...f, effectiveDate: e.target.value })} />
        <TextField label="Interview notes" multiline minRows={2}
          value={f.interviewNotes}
          onChange={(e) => setF({ ...f, interviewNotes: e.target.value })} />
      </CrudDrawer>
    </Box>
  );
}
