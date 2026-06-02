'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { BenefitStats } from '@hrms/contracts';
import { api } from '@/lib/api';

const cols: GridColDef[] = [
  { field: 'staffNo', headerName: 'Staff', width: 110 },
  { field: 'benefitTypeCode', headerName: 'Benefit', width: 140 },
  { field: 'endedOn', headerName: 'Ended', width: 140 },
];

/** Monthly benefit statistics + cessation report (UR-HBM-007/008). */
export default function BenefitStatsPage() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [s, setS] = useState<BenefitStats | null>(null);

  const load = () =>
    api<BenefitStats>(`/hbm/stats?period=${period}`).then(setS);
  useEffect(() => { load(); }, []); // eslint-disable-line

  const maxEnr = Math.max(1, ...(s?.byCategory.map((b) => b.enrolments) ?? [0]));

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Benefit Statistics
      </Typography>
      <Stack direction="row" spacing={2} mb={3} alignItems="center">
        <TextField size="small" label="Period (YYYY-MM)" value={period}
          onChange={(e) => setPeriod(e.target.value)} />
        <button onClick={load} style={{ padding: '6px 12px' }}>Refresh</button>
      </Stack>

      {s && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Card variant="outlined">
              <CardContent>
                <Typography fontWeight={600} mb={2}>
                  Enrolments + invoiced totals by category
                </Typography>
                {s.byCategory.map((b) => (
                  <Stack key={b.category} direction="row" spacing={2}
                    alignItems="center" mb={1}>
                    <Box width={110}>{b.category}</Box>
                    <Box flexGrow={1}>
                      <LinearProgress variant="determinate"
                        value={(b.enrolments / maxEnr) * 100} />
                    </Box>
                    <Box width={50}>{b.enrolments}</Box>
                    <Box width={90} textAlign="right">${b.invoicedTotal.toFixed(0)}</Box>
                  </Stack>
                ))}
                {s.byCategory.length === 0 && (
                  <Typography color="text.secondary">No data for {period}.</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={5}>
            <Card variant="outlined">
              <CardContent>
                <Typography fontWeight={600} mb={2}>
                  Cessations this period
                </Typography>
                <div style={{ height: 320, width: '100%' }}>
                  <DataGrid
                    rows={s.cessationsThisMonth.map((c, i) => ({ id: i, ...c }))}
                    columns={cols}
                    hideFooter
                    disableRowSelectionOnClick
                  />
                </div>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
