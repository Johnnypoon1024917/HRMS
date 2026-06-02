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
import type { AppraisalView } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';

/** Appraiser (manager) queue — rate team members. Cannot appraise self. */
export default function AppraiseQueuePage() {
  const notify = useNotify();
  const [rows, setRows] = useState<AppraisalView[]>([]);
  const [open, setOpen] = useState<AppraisalView | null>(null);
  const [comments, setComments] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [overall, setOverall] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setRows(await api<AppraisalView[]>('/pem/appraise'));
    } catch (e: any) {
      notify.error(e.message);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (r: AppraisalView) => {
    setOpen(r);
    setComments(r.appraiserComments ?? '');
    setScores(r.scores ?? {});
    setOverall(r.overallRating ?? '');
  };

  const submit = async () => {
    if (!open) return;
    setSaving(true);
    try {
      await api(`/pem/reports/${open.id}/appraise`, {
        method: 'POST',
        body: JSON.stringify({
          appraiserComments: comments,
          scores,
          overallRating: Number(overall),
        }),
      });
      notify.success('Appraisal submitted.');
      setOpen(null);
      load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const finalise = async (id: string) => {
    try {
      await api(`/pem/reports/${id}/finalise`, { method: 'POST' });
      notify.success('Appraisal finalised.');
      load();
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Appraisal Queue"
        subtitle="Rate your team members. You cannot appraise yourself."
      />

      <Stack spacing={1.5}>
        {rows.length === 0 && (
          <Typography color="text.secondary">Nothing to appraise.</Typography>
        )}
        {rows.map((r) => (
          <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box flexGrow={1}>
                <Typography fontWeight={600}>
                  {r.staffName} ({r.staffNo})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {r.cycleName} · scale {r.ratingMin}–{r.ratingMax}
                  {r.selfComments ? ' · self-assessment submitted' : ''}
                </Typography>
              </Box>
              <Chip size="small" label={r.status} />
              {r.status !== 'finalised' && (
                <Button size="small" variant="contained" onClick={() => edit(r)}>
                  Appraise
                </Button>
              )}
              {r.status === 'appraised' && (
                <Button size="small" variant="outlined" onClick={() => finalise(r.id)}>
                  Finalise
                </Button>
              )}
            </Stack>
          </Paper>
        ))}
      </Stack>

      <CrudDrawer
        open={!!open}
        title="Appraise"
        subtitle={open ? `${open.staffName} (${open.staffNo})` : undefined}
        onClose={() => setOpen(null)}
        onSubmit={submit}
        submitLabel="Submit"
        submitting={saving}
      >
        {open && (
          <>
            {open.selfComments && (
              <Alert severity="info">
                Employee said: {open.selfComments}
              </Alert>
            )}
            {open.sections.map((s) => (
              <TextField
                key={s} type="number"
                label={`${s} (${open.ratingMin}-${open.ratingMax})`}
                value={scores[s] ?? ''}
                onChange={(e) =>
                  setScores({ ...scores, [s]: Number(e.target.value) })
                }
              />
            ))}
            <TextField
              type="number" label="Overall rating"
              value={overall}
              onChange={(e) => setOverall(Number(e.target.value))}
            />
            <TextField
              fullWidth multiline minRows={3} label="Appraiser comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </>
        )}
      </CrudDrawer>
    </Box>
  );
}
