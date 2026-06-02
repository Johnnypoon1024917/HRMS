'use client';

import { useEffect, useState } from 'react';
import {
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
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';

const emptyForm = {
  name: '',
  periodYear: new Date().getFullYear(),
  ratingMin: 1,
  ratingMax: 5,
};

/** Appraisal cycle admin: create, "call" (generate) reports, view spread. */
export default function CyclesPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(emptyForm);
  const [dist, setDist] = useState<RatingDistribution | null>(null);

  const load = async () => {
    try {
      setRows(await api<any[]>('/pem/cycles'));
    } catch (e: any) {
      notify.error(e.message);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDrawer = () => { setF(emptyForm); setOpen(true); };

  const create = async () => {
    setSaving(true);
    try {
      await api('/pem/cycles', {
        method: 'PUT',
        body: JSON.stringify({
          ...f,
          sections: ['delivery', 'teamwork', 'leadership'],
          status: 'draft',
        }),
      });
      notify.success('Cycle created.');
      setOpen(false);
      load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const generate = async (id: string) => {
    try {
      const r = await api<{ generated: number; total: number }>(
        `/pem/cycles/${id}/generate`,
        { method: 'POST' },
      );
      notify.success(`Generated ${r.generated} of ${r.total} appraisal reports.`);
      load();
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  const showDist = async (id: string) => {
    try {
      setDist(await api<RatingDistribution>(`/pem/cycles/${id}/distribution`));
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Appraisal Cycles"
        primary={{ label: 'New cycle', icon: 'add', onClick: openDrawer }}
      />

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

      <CrudDrawer
        open={open}
        title="New appraisal cycle"
        onClose={() => setOpen(false)}
        onSubmit={create}
        submitLabel="Create cycle"
        submitting={saving}
        submitDisabled={!f.name}
      >
        <TextField label="Name" value={f.name} required
          onChange={(e) => setF({ ...f, name: e.target.value })} />
        <TextField type="number" label="Year" value={f.periodYear}
          onChange={(e) => setF({ ...f, periodYear: Number(e.target.value) })} />
        <TextField type="number" label="Rating min" value={f.ratingMin}
          onChange={(e) => setF({ ...f, ratingMin: Number(e.target.value) })} />
        <TextField type="number" label="Rating max" value={f.ratingMax}
          onChange={(e) => setF({ ...f, ratingMax: Number(e.target.value) })} />
      </CrudDrawer>
    </Box>
  );
}
