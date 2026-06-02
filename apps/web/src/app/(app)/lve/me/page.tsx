'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Grid,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type {
  LeaveBalance,
  LeaveRequestView,
} from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';

const cols: GridColDef[] = [
  { field: 'leaveTypeCode', headerName: 'Type', width: 90 },
  { field: 'startDate', headerName: 'From', width: 120 },
  { field: 'endDate', headerName: 'To', width: 120 },
  { field: 'days', headerName: 'Days', width: 80 },
  {
    field: 'status',
    headerName: 'Status',
    width: 130,
    renderCell: (p) => (
      <Chip
        size="small"
        label={p.value}
        color={
          p.value === 'approved'
            ? 'success'
            : p.value === 'rejected'
              ? 'error'
              : p.value === 'pending'
                ? 'warning'
                : 'default'
        }
      />
    ),
  },
  { field: 'reason', headerName: 'Reason', flex: 1 },
];

const emptyForm = {
  leaveTypeCode: 'AL',
  startDate: '',
  endDate: '',
  halfDay: false,
  reason: '',
};

export default function MyLeavePage() {
  const notify = useNotify();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [rows, setRows] = useState<LeaveRequestView[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      setBalances(await api<LeaveBalance[]>('/lve/balances'));
      setRows(await api<LeaveRequestView[]>('/lve/me'));
    } catch (e: any) {
      notify.error(e.message);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDrawer = () => { setForm(emptyForm); setOpen(true); };

  const submit = async () => {
    setSaving(true);
    try {
      await api('/lve/requests', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      notify.success('Leave request submitted');
      setOpen(false);
      load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="My Leave"
        primary={{ label: 'Request leave', icon: 'add', onClick: openDrawer }}
      />

      <Grid container spacing={2} mb={3}>
        {balances.map((b) => (
          <Grid key={b.leaveTypeCode} item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  {b.leaveTypeName}
                </Typography>
                <Typography variant="h5" fontWeight={600}>
                  {b.remaining}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  quota {b.quota} · taken {b.taken} · pending {b.pending}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <div style={{ height: 420, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick />
      </div>

      <CrudDrawer
        open={open}
        title="Request leave"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Submit"
        submitting={saving}
        submitDisabled={!form.startDate || !form.endDate}
      >
        <TextField
          select label="Type"
          value={form.leaveTypeCode}
          onChange={(e) => setForm({ ...form, leaveTypeCode: e.target.value })}
        >
          {balances.map((b) => (
            <MenuItem key={b.leaveTypeCode} value={b.leaveTypeCode}>
              {b.leaveTypeName}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="date" label="From" InputLabelProps={{ shrink: true }}
          value={form.startDate}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
        />
        <TextField
          type="date" label="To" InputLabelProps={{ shrink: true }}
          value={form.endDate}
          onChange={(e) => setForm({ ...form, endDate: e.target.value })}
        />
        <FormControlLabel
          control={
            <Switch
              checked={form.halfDay}
              onChange={(e) => setForm({ ...form, halfDay: e.target.checked })}
            />
          }
          label="½ day"
        />
        <TextField
          label="Reason"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
        />
      </CrudDrawer>
    </Box>
  );
}
