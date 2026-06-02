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

/** Appraiser (manager) queue — rate team members. Cannot appraise self. */
export default function AppraiseQueuePage() {
  const [rows, setRows] = useState<AppraisalView[]>([]);
  const [open, setOpen] = useState<AppraisalView | null>(null);
  const [comments, setComments] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [overall, setOverall] = useState<number | ''>('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api<AppraisalView[]>('/pem/appraise').then(setRows);
  useEffect(() => { load(); }, []);

  const edit = (r: AppraisalView) => {
    setOpen(r);
    setComments(r.appraiserComments ?? '');
    setScores(r.scores ?? {});
    setOverall(r.overallRating ?? '');
    setErr('');
    setMsg('');
  };

  const submit = async () => {
    if (!open) return;
    setErr('');
    try {
      await api(`/pem/reports/${open.id}/appraise`, {
        method: 'POST',
        body: JSON.stringify({
          appraiserComments: comments,
          scores,
          overallRating: Number(overall),
        }),
      });
      setMsg('Appraisal submitted.');
      setOpen(null);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const finalise = async (id: string) => {
    await api(`/pem/reports/${id}/finalise`, { method: 'POST' });
    load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Appraisal Queue
      </Typography>
      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}

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

            {open?.id === r.id && (
              <Box mt={2}>
                {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
                {r.selfComments && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Employee said: {r.selfComments}
                  </Alert>
                )}
                {r.sections.map((s) => (
                  <TextField
                    key={s} size="small" type="number"
                    label={`${s} (${r.ratingMin}-${r.ratingMax})`}
                    sx={{ mr: 2, mb: 2, width: 180 }}
                    value={scores[s] ?? ''}
                    onChange={(e) =>
                      setScores({ ...scores, [s]: Number(e.target.value) })
                    }
                  />
                ))}
                <TextField
                  size="small" type="number" label="Overall rating"
                  sx={{ mb: 2, width: 180, display: 'block' }}
                  value={overall}
                  onChange={(e) => setOverall(Number(e.target.value))}
                />
                <TextField
                  fullWidth multiline minRows={3} label="Appraiser comments"
                  value={comments} sx={{ mb: 2 }}
                  onChange={(e) => setComments(e.target.value)}
                />
                <Button variant="contained" onClick={submit}>Submit</Button>
                <Button sx={{ ml: 1 }} onClick={() => setOpen(null)}>Cancel</Button>
              </Box>
            )}
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
