'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type {
  PayCalendarEntry,
  PayExportView,
  PayRunResult,
  PayRunVariance,
  Payslip,
} from '@hrms/contracts';
import { api } from '@/lib/api';

const fmt = (n: number, ccy = 'HKD') =>
  new Intl.NumberFormat('en-HK', { style: 'currency', currency: ccy }).format(n);

const slipCols: GridColDef[] = [
  { field: 'staffNo', headerName: 'Staff', width: 100 },
  { field: 'staffNameEn', headerName: 'Name', flex: 1 },
  { field: 'gross', headerName: 'Gross', width: 110, valueFormatter: (v: any) => fmt(v ?? 0) },
  { field: 'tax', headerName: 'Tax', width: 100, valueFormatter: (v: any) => fmt(v ?? 0) },
  { field: 'mpfEmployee', headerName: 'MPF (EE)', width: 110, valueFormatter: (v: any) => fmt(v ?? 0) },
  { field: 'totalDeductions', headerName: 'Deductions', width: 120, valueFormatter: (v: any) => fmt(v ?? 0) },
  {
    field: 'net', headerName: 'Net', width: 130,
    renderCell: (p) => (p.value === -1 ? <span>••••</span> : <b>{fmt(p.value ?? 0)}</b>),
  },
];

const varianceCols: GridColDef[] = [
  { field: 'staffNo', headerName: 'Staff', width: 100 },
  { field: 'previous', headerName: 'Previous', width: 130, valueFormatter: (v: any) => fmt(v ?? 0) },
  { field: 'current', headerName: 'Current', width: 130, valueFormatter: (v: any) => fmt(v ?? 0) },
  {
    field: 'delta', headerName: 'Δ', width: 130,
    renderCell: (p) => (
      <span style={{ color: p.value > 0 ? '#1e8e3e' : p.value < 0 ? '#d93025' : undefined }}>
        {p.value > 0 ? '+' : ''}{fmt(p.value ?? 0)}
      </span>
    ),
  },
  { field: 'pctChange', headerName: '% Change', width: 110, valueFormatter: (v: any) => `${(v ?? 0).toFixed(1)}%` },
];

export default function PayRunsPage() {
  const [groupCode] = useState('MONTHLY-HK');
  const [calendar, setCalendar] = useState<PayCalendarEntry[]>([]);
  const [period, setPeriod] = useState('');
  const [run, setRun] = useState<PayRunResult | null>(null);
  const [slips, setSlips] = useState<Payslip[]>([]);
  const [variance, setVariance] = useState<PayRunVariance | null>(null);
  const [exports, setExports] = useState<PayExportView[]>([]);
  const [exportFmt, setExportFmt] = useState('iso20022_pain001');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [history, setHistory] = useState<PayRunResult[]>([]);

  useEffect(() => {
    api<PayCalendarEntry[]>(`/pay/calendar/${groupCode}`).then((c) => {
      setCalendar(c);
      if (!period && c.length) {
        const now = new Date();
        const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
        setPeriod(c.find((x) => x.period === ym)?.period ?? c[c.length - 1].period);
      }
    });
    api<PayRunResult[]>(`/pay/runs?groupCode=${groupCode}`).then(setHistory);
  }, [groupCode, period]);

  const loadRunDetails = async (r: PayRunResult) => {
    setRun(r);
    setSlips(await api<Payslip[]>(`/pay/runs/${r.id}/payslips`).catch(() => []));
    setVariance(await api<PayRunVariance>(`/pay/runs/${r.id}/variance`).catch(() => null));
    setExports(await api<PayExportView[]>(`/pay/runs/${r.id}/exports`).catch(() => []));
  };

  const create = async () => {
    setErr(''); setMsg('');
    try {
      const r = await api<PayRunResult>('/pay/runs', {
        method: 'POST',
        body: JSON.stringify({ groupCode, period, type: 'regular' }),
      });
      setHistory((h) => [r, ...h.filter((x) => x.id !== r.id)]);
      await loadRunDetails(r);
    } catch (e: any) { setErr(e.message); }
  };

  const approve = async () => {
    if (!run) return;
    try {
      const r = await api<PayRunResult>(`/pay/runs/${run.id}/approve`, { method: 'POST' });
      setMsg('Run approved.'); setRun(r);
    } catch (e: any) { setErr(e.message); }
  };
  const markPaid = async () => {
    if (!run) return;
    try {
      const r = await api<PayRunResult>(`/pay/runs/${run.id}/pay`, { method: 'POST' });
      setMsg('Run marked as paid.'); setRun(r);
    } catch (e: any) { setErr(e.message); }
  };
  const reverse = async () => {
    if (!run) return;
    try {
      const r = await api<PayRunResult>(`/pay/runs/${run.id}/reverse`, { method: 'POST' });
      setMsg('Run reversed; YTD rolled back.'); setRun(r);
    } catch (e: any) { setErr(e.message); }
  };
  const exportBank = async () => {
    if (!run) return;
    try {
      await api(`/pay/runs/${run.id}/exports/bank`, {
        method: 'POST',
        body: JSON.stringify({ format: exportFmt }),
      });
      setExports(await api<PayExportView[]>(`/pay/runs/${run.id}/exports`));
      setMsg('Bank file generated.');
    } catch (e: any) { setErr(e.message); }
  };
  const exportGl = async () => {
    if (!run) return;
    try {
      await api(`/pay/runs/${run.id}/exports/gl`, { method: 'POST' });
      setMsg('GL journal posted.');
    } catch (e: any) { setErr(e.message); }
  };

  return (
    <Box sx={{ maxWidth: 1400 }}>
      <Typography variant="h4" mb={0.5}>Payroll runs</Typography>
      <Typography color="text.secondary" mb={3}>
        Pay group <b>{groupCode}</b> · {history.length} historical run{history.length === 1 ? '' : 's'}
      </Typography>

      {/* Create */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <TextField
            select size="small" label="Period" value={period}
            onChange={(e) => setPeriod(e.target.value)} sx={{ minWidth: 180 }}
          >
            {calendar.map((c) => (
              <MenuItem key={c.id} value={c.period}>
                {c.period} · pay {new Date(c.paymentDate).toLocaleDateString()}
                {c.status !== 'open' ? ` · ${c.status}` : ''}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={create} disabled={!period}>
            Calculate run
          </Button>
          <Box flexGrow={1} />
          {run && run.status === 'calculated' && (
            <Button variant="outlined" onClick={approve}>Approve (dual control)</Button>
          )}
          {run && run.status === 'approved' && (
            <Button variant="outlined" onClick={markPaid}>Mark paid</Button>
          )}
          {run && ['approved', 'paid'].includes(run.status) && (
            <Button variant="text" color="error" onClick={reverse}>Reverse</Button>
          )}
        </Stack>
      </Paper>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      {/* Totals */}
      {run && (
        <Grid container spacing={2} mb={3}>
          {[
            { label: 'Status', value: run.status, chip: true },
            { label: 'Headcount', value: run.headcount },
            { label: 'Gross', value: fmt(run.totalGross) },
            { label: 'Tax', value: fmt(run.totalTax) },
            { label: 'Deductions', value: fmt(run.totalDeductions) },
            { label: 'Net pay', value: fmt(run.totalNet), strong: true },
            { label: 'Employer cost', value: fmt(run.totalEmployerCost) },
          ].map((s) => (
            <Grid key={s.label} item xs={6} sm={4} md={1.7}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                {s.chip ? (
                  <Box mt={0.5}>
                    <Chip
                      label={s.value as string}
                      size="small"
                      color={
                        run.status === 'paid' ? 'success' :
                        run.status === 'approved' ? 'primary' :
                        run.status === 'reversed' ? 'error' : 'warning'
                      }
                    />
                  </Box>
                ) : (
                  <Typography fontWeight={s.strong ? 700 : 600} fontSize={s.strong ? 18 : 16}>
                    {s.value}
                  </Typography>
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Payslips */}
      {run && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" mb={1}>Payslips</Typography>
          <div style={{ height: 360, width: '100%' }}>
            <DataGrid
              rows={slips.map((s, i) => ({ id: i, ...s }))}
              columns={slipCols}
              disableRowSelectionOnClick
              density="compact"
            />
          </div>
        </Paper>
      )}

      {/* Variance */}
      {variance && variance.previousRunId && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2} mb={1}>
            <Typography variant="subtitle1">Variance vs previous run</Typography>
            <Chip
              label={`${variance.totalDelta >= 0 ? '+' : ''}${fmt(variance.totalDelta)} total`}
              color={variance.totalDelta > 0 ? 'success' : variance.totalDelta < 0 ? 'error' : 'default'}
              size="small"
            />
          </Stack>
          <div style={{ height: 300, width: '100%' }}>
            <DataGrid
              rows={variance.rows.map((r, i) => ({ id: i, ...r }))}
              columns={varianceCols}
              disableRowSelectionOnClick
              density="compact"
            />
          </div>
        </Paper>
      )}

      {/* Exports */}
      {run && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" mb={1}>Exports</Typography>
          <Stack direction="row" spacing={2} alignItems="center" mb={2}>
            <TextField
              select size="small" label="Bank file format" value={exportFmt}
              onChange={(e) => setExportFmt(e.target.value)} sx={{ minWidth: 240 }}
            >
              <MenuItem value="iso20022_pain001">ISO 20022 pain.001 XML</MenuItem>
              <MenuItem value="hsbc_csv">HSBC Autopay CSV</MenuItem>
            </TextField>
            <Button variant="outlined" onClick={exportBank}>Generate bank file</Button>
            <Divider orientation="vertical" flexItem />
            <Button variant="outlined" onClick={exportGl}>Post GL journal</Button>
          </Stack>
          {exports.length > 0 && (
            <Stack spacing={1}>
              {exports.map((e) => (
                <Stack key={e.id} direction="row" spacing={2} alignItems="center">
                  <Chip size="small" label={e.format} />
                  <Typography variant="body2" color="text.secondary">
                    {new Date(e.generatedAt).toLocaleString()}
                  </Typography>
                  <Typography variant="body2">
                    {e.itemCount} items · {fmt(e.totalAmount)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {e.fileKey}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      {/* History */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" mb={1}>History</Typography>
        <Stack spacing={1}>
          {history.map((h) => (
            <Stack key={h.id} direction="row" spacing={2} alignItems="center"
              sx={{
                p: 1, borderRadius: 2, cursor: 'pointer',
                bgcolor: run?.id === h.id ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
              onClick={() => loadRunDetails(h)}
            >
              <Typography sx={{ width: 110, fontWeight: 500 }}>{h.period}</Typography>
              <Chip size="small" label={h.status} />
              <Typography variant="body2" color="text.secondary">
                {h.headcount} staff · {fmt(h.totalNet)}
              </Typography>
            </Stack>
          ))}
          {history.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No runs yet — pick a period above and calculate one.
            </Typography>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
