'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { StaffListItem, TerminationView } from '@hrms/contracts';
import { api } from '@/lib/api';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-HK', { style: 'currency', currency: 'HKD' }).format(n);

const REASONS = [
  { value: 'resignation', label: 'Resignation' },
  { value: 'dismissal', label: 'Dismissal' },
  { value: 'redundancy', label: 'Redundancy' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'death', label: 'Death in service' },
];

export default function TerminationsPage() {
  const [staff, setStaff] = useState<StaffListItem[]>([]);
  const [staffId, setStaffId] = useState('');
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState<any>('resignation');
  const [notice, setNotice] = useState(1);
  const [accrued, setAccrued] = useState<number | ''>('');
  const [preview, setPreview] = useState<TerminationView | null>(null);
  const [list, setList] = useState<TerminationView[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api<{ items: StaffListItem[] }>('/pim/staff?page=1&pageSize=100').then((r) =>
      setStaff(r.items),
    );
    api<TerminationView[]>('/pay/terminations').then(setList);
  }, []);

  const doPreview = async () => {
    setErr(''); setMsg('');
    try {
      const body = {
        staffId,
        exitDate,
        reason,
        noticeMonths: notice,
        accruedLeaveDays: accrued === '' ? undefined : Number(accrued),
        extraPayments: [],
      };
      setPreview(await api<TerminationView>('/pay/terminations/preview', {
        method: 'POST', body: JSON.stringify(body),
      }));
    } catch (e: any) { setErr(e.message); }
  };
  const commit = async () => {
    if (!preview) return;
    setErr(''); setMsg('');
    try {
      const body = {
        staffId, exitDate, reason, noticeMonths: notice,
        accruedLeaveDays: accrued === '' ? undefined : Number(accrued),
        extraPayments: [],
      };
      const r = await api<TerminationView>('/pay/terminations', {
        method: 'POST', body: JSON.stringify(body),
      });
      setMsg(`Settlement saved (id: ${r.id})`);
      setList(await api<TerminationView[]>('/pay/terminations'));
    } catch (e: any) { setErr(e.message); }
  };

  const SettlementRow = ({ label, value, bold, dim }:
    { label: string; value: number; bold?: boolean; dim?: boolean }) =>
    value !== 0 || bold ? (
      <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
        <Typography
          variant="body2"
          color={dim ? 'text.secondary' : undefined}
          sx={{ fontWeight: bold ? 600 : 400 }}
        >{label}</Typography>
        <Typography sx={{ fontWeight: bold ? 700 : 500 }}>
          {value < 0 ? '−' : ''}{fmt(Math.abs(value))}
        </Typography>
      </Stack>
    ) : null;

  return (
    <Box sx={{ maxWidth: 1100 }}>
      <Typography variant="h4" mb={0.5}>Final settlement</Typography>
      <Typography color="text.secondary" mb={3}>
        HK statutory calculator — severance / long-service pay, payment in lieu of
        notice, accrued leave, pro-ration, outstanding loans.
      </Typography>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" mb={2}>Inputs</Typography>
            <Stack spacing={2}>
              <TextField select size="small" label="Staff" value={staffId}
                onChange={(e) => setStaffId(e.target.value)} fullWidth>
                {staff.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.staffNo} · {s.nameEn}
                  </MenuItem>
                ))}
              </TextField>
              <TextField size="small" type="date" label="Exit date" value={exitDate}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setExitDate(e.target.value)} fullWidth />
              <TextField select size="small" label="Reason" value={reason}
                onChange={(e) => setReason(e.target.value)} fullWidth>
                {REASONS.map((r) => (
                  <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                ))}
              </TextField>
              <TextField size="small" type="number" label="Notice months (if PILN)"
                value={notice} onChange={(e) => setNotice(Number(e.target.value))} fullWidth />
              <TextField size="small" type="number" label="Accrued leave days (blank = auto)"
                value={accrued} onChange={(e) => setAccrued(e.target.value === '' ? '' : Number(e.target.value))} fullWidth />
              <Stack direction="row" spacing={1.5}>
                <Button variant="contained" onClick={doPreview} disabled={!staffId}>Preview</Button>
                {preview && <Button variant="outlined" onClick={commit}>Save settlement</Button>}
              </Stack>
              {err && <Alert severity="error">{err}</Alert>}
              {msg && <Alert severity="success">{msg}</Alert>}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          {preview ? (
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={2}>
                  <Typography variant="subtitle1">Calculated settlement</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {preview.monthsOfService.toFixed(1)} months of service
                  </Typography>
                </Stack>
                <SettlementRow label="Pro-rated final-month salary" value={preview.proratedSalary} />
                <SettlementRow label="Severance pay" value={preview.severancePay} />
                <SettlementRow label="Long-service pay" value={preview.longServicePay} />
                <SettlementRow label="Payment in lieu of notice" value={preview.paymentInLieuNotice} />
                <SettlementRow label="Accrued leave payout" value={preview.accruedLeavePay} />
                <Divider sx={{ my: 1.5 }} />
                <SettlementRow label="Total gross" value={preview.totalGross} bold />
                <SettlementRow label="Outstanding loan deductions" value={-preview.outstandingLoans} dim />
                <Divider sx={{ my: 1.5 }} />
                <SettlementRow label="Net payable" value={preview.net} bold />
                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    SP and LSP are mutually exclusive under HK law. Cap: 2/3 × min(monthly, $22,500)
                    × years of service, overall capped at $390,000.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ) : (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              Pick a staff member and click Preview.
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* History */}
      {list.length > 0 && (
        <Box mt={4}>
          <Typography variant="subtitle1" mb={1.5}>Recent settlements</Typography>
          <Stack spacing={1}>
            {list.map((s) => (
              <Paper key={s.id} variant="outlined" sx={{ p: 1.5, display: 'flex', gap: 2, alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 500, width: 140 }}>{s.staffId.slice(0, 12)}…</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ width: 110 }}>
                  {new Date(s.exitDate).toLocaleDateString()}
                </Typography>
                <Typography variant="body2" sx={{ width: 130 }}>{s.reason}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {s.monthsOfService.toFixed(1)}m service
                </Typography>
                <Box flexGrow={1} />
                <Typography sx={{ fontWeight: 600 }}>{fmt(s.net)}</Typography>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
