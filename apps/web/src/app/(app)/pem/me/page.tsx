'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import type { AppraisalView } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';

function statusColor(s: string) {
  return s === 'finalised'
    ? 'success'
    : s === 'appraised'
      ? 'info'
      : s === 'self_done'
        ? 'warning'
        : 'default';
}

/** Employee self-assessment (UR-PEM): complete own appraisal sections. */
export default function MyAppraisalsPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<AppraisalView[]>([]);
  const [open, setOpen] = useState<AppraisalView | null>(null);
  const [comments, setComments] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setRows(await api<AppraisalView[]>('/pem/me'));
    } catch (e: any) {
      notify.error(e.message);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (r: AppraisalView) => {
    setOpen(r);
    setComments(r.selfComments ?? '');
    setScores(r.selfScores ?? {});
  };

  const submit = async () => {
    if (!open) return;
    setSaving(true);
    try {
      await api(`/pem/reports/${open.id}/self`, {
        method: 'POST',
        body: JSON.stringify({ selfComments: comments, selfScores: scores }),
      });
      notify.success('Self-assessment submitted.');
      setOpen(null);
      load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader title="My Appraisals" />

      <Stack spacing={1.5}>
        {rows.length === 0 && (
          <Typography color="text.secondary">No appraisals yet.</Typography>
        )}
        {rows.map((r) => (
          <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box flexGrow={1}>
                <Typography fontWeight={600}>{r.cycleName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Rating scale {r.ratingMin}–{r.ratingMax} ·{' '}
                  {r.overallRating != null ? `Overall ${r.overallRating}` : 'Not yet rated'}
                </Typography>
              </Box>
              <Chip size="small" label={r.status} color={statusColor(r.status) as any} />
              {['pending', 'self_done'].includes(r.status) && (
                <Button size="small" variant="contained" onClick={() => edit(r)}>
                  Self-assess
                </Button>
              )}
            </Stack>
          </Paper>
        ))}
      </Stack>

      <CrudDrawer
        open={!!open}
        title="Self-assessment"
        subtitle={open?.cycleName}
        onClose={() => setOpen(null)}
        onSubmit={submit}
        submitLabel="Submit"
        submitting={saving}
      >
        {open?.sections.map((s) => (
          <TextField
            key={s}
            size="small"
            type="number"
            label={`${s} (${open.ratingMin}-${open.ratingMax})`}
            sx={{ width: 180 }}
            value={scores[s] ?? ''}
            onChange={(e) => setScores({ ...scores, [s]: Number(e.target.value) })}
          />
        ))}
        <TextField
          fullWidth
          multiline
          minRows={3}
          label="Self comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
      </CrudDrawer>
    </Box>
  );
}
