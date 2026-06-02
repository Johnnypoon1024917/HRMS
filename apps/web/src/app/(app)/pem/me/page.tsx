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
  const [rows, setRows] = useState<AppraisalView[]>([]);
  const [open, setOpen] = useState<AppraisalView | null>(null);
  const [comments, setComments] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState('');

  const load = () => api<AppraisalView[]>('/pem/me').then(setRows);
  useEffect(() => { load(); }, []);

  const edit = (r: AppraisalView) => {
    setOpen(r);
    setComments(r.selfComments ?? '');
    setScores(r.selfScores ?? {});
    setMsg('');
  };

  const submit = async () => {
    if (!open) return;
    await api(`/pem/reports/${open.id}/self`, {
      method: 'POST',
      body: JSON.stringify({ selfComments: comments, selfScores: scores }),
    });
    setMsg('Self-assessment submitted.');
    setOpen(null);
    load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        My Appraisals
      </Typography>
      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}

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

            {open?.id === r.id && (
              <Box mt={2}>
                {r.sections.map((s) => (
                  <TextField
                    key={s}
                    size="small"
                    type="number"
                    label={`${s} (${r.ratingMin}-${r.ratingMax})`}
                    sx={{ mr: 2, mb: 2, width: 180 }}
                    value={scores[s] ?? ''}
                    onChange={(e) =>
                      setScores({ ...scores, [s]: Number(e.target.value) })
                    }
                  />
                ))}
                <TextField
                  fullWidth multiline minRows={3} label="Self comments"
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
