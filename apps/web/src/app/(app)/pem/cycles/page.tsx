'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { RatingDistribution } from '@hrms/contracts';
import { api } from '@/lib/api';

/** Appraisal cycle admin: create, "call" (generate) reports, view spread. */
export default function CyclesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({
    name: '',
    periodYear: new Date().getFullYear(),
    ratingMin: 1,
    ratingMax: 5,
  });
  const [dist, setDist] = useState<RatingDistribution | null>(null);
  const [msg, setMsg] = useState('');

  const load = () => api<any[]>('/pem/cycles').then(setRows);
  useEffect(() => { load(); }, []);

  const create = async () => {
    await api('/pem/cycles', {
      method: 'PUT',
      body: JSON.stringify({
        ...f,
        sections: ['delivery', 'teamwork', 'leadership'],
        status: 'draft',
      }),
    });
    setMsg('Cycle created.');
    load();
  };

  const generate = async (id: string) => {
    const r = await api<{ generated: number; total: number }>(
      `/pem/cycles/${id}/generate`,
      { method: 'POST' },
    );
    setMsg(`Generated ${r.generated} of ${r.total} appraisal reports.`);
    load();
  };

  const showDist = async (id: string) => {
    setDist(await api<RatingDistribution>(`/pem/cycles/${id}/distribution`));
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Appraisal Cycles
      </Typography>
      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField size="small" label="Name" value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })} />
          <TextField size="small" type="number" label="Year" sx={{ width: 110 }}
            value={f.periodYear}
            onChange={(e) => setF({ ...f, periodYear: Number(e.target.value) })} />
          <TextField size="small" type="number" label="Rating min" sx={{ width: 110 }}
            value={f.ratingMin}
            onChange={(e) => setF({ ...f, ratingMin: Number(e.target.value) })} />
          <TextField size="small" type="number" label="Rating max" sx={{ width: 110 }}
            value={f.ratingMax}
            onChange={(e) => setF({ ...f, ratingMax: Number(e.target.value) })} />
          <Button variant="contained" onClick={create}>Create cycle</Button>
        </Stack>
      </Paper>

      <Stack spacing={1.5}>
        {rows.map((c) => (
          <Paper key={c.id} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box flexGrow={1}>
                <Typography fontWeight={600}>
                  {c.name} · {c.periodYear}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  scale {c.ratingMin}–{c.ratingMax} · sections {c.sections.join(', ')}
                </Typography>
              </Box>
              <Chip size="small" label={c.status}
                color={c.status === 'open' ? 'success' : 'default'} />
              <Button size="small" variant="contained" onClick={() => generate(c.id)}>
                Call appraisals
              </Button>
              <Button size="small" variant="outlined" onClick={() => showDist(c.id)}>
                Distribution
              </Button>
            </Stack>

            {dist && dist.cycleId === c.id && (
              <Box mt={2}>
                <Typography variant="body2" mb={1}>
                  {dist.finalised}/{dist.total} finalised
                </Typography>
                {dist.buckets.map((b) => (
                  <Stack key={b.rating} direction="row" spacing={2} alignItems="center" mb={0.5}>
                    <Box width={60}>Rating {b.rating}</Box>
                    <Box flexGrow={1}>
                      <LinearProgress
                        variant="determinate"
                        value={dist.total ? (b.count / dist.total) * 100 : 0}
                      />
                    </Box>
                    <Box width={30}>{b.count}</Box>
                  </Stack>
                ))}
              </Box>
            )}
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
