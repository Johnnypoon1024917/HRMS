'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Stack,
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

export default function MyLeavePage() {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [rows, setRows] = useState<LeaveRequestView[]>([]);
  const [form, setForm] = useState({
    leaveTypeCode: 'AL',
    startDate: '',
    endDate: '',
    halfDay: false,
    reason: '',
  });
  const [err, setErr] = useState('');

  const load = () => {
    api<LeaveBalance[]>('/lve/balances').then(setBalances);
    api<LeaveRequestView[]>('/lve/me').then(setRows);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setErr('');
    try {
      await api('/lve/requests', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({ ...form, startDate: '', endDate: '', reason: '' });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        My Leave
      </Typography>

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

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography fontWeight={600} mb={2}>
          Request leave
        </Typography>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField
            select size="small" label="Type" sx={{ minWidth: 160 }}
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
            size="small" type="date" label="From" InputLabelProps={{ shrink: true }}
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
          <TextField
            size="small" type="date" label="To" InputLabelProps={{ shrink: true }}
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
            size="small" label="Reason" sx={{ flexGrow: 1 }}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
          <Button variant="contained" onClick={submit}>
            Submit
          </Button>
        </Stack>
      </Paper>

      <div style={{ height: 420, width: '100%' }}>
        <DataGrid rows={rows} columns={cols} disableRowSelectionOnClick />
      </div>
    </Box>
  );
}
