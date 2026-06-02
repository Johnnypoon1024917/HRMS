'use client';

import { Suspense, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSearchParams } from 'next/navigation';
import type {
  ApplicationView,
  PipelineColumn,
} from '@hrms/contracts';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic'; // useSearchParams

// `ApplicationStage` in @hrms/contracts is a Zod schema (runtime value),
// not a TS type. The controller's MoveStageSchema.parse(body) enforces the
// allowed values; here we use plain string typing.
const NEXT_STAGES: Record<string, string[]> = {
  applied: ['screened', 'rejected', 'withdrawn'],
  screened: ['interview', 'rejected', 'withdrawn'],
  interview: ['offer', 'rejected', 'withdrawn'],
  offer: ['rejected', 'withdrawn'], // 'hired' goes through /rec/hire
};

// Next 14 CSR-bailout rule: `useSearchParams` must be wrapped in a
// Suspense boundary at the *page* level even for client-only pages.
export default function PipelinePage() {
  return (
    <Suspense fallback={null}>
      <PipelineInner />
    </Suspense>
  );
}

function PipelineInner() {
  const params = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [cols, setCols] = useState<PipelineColumn[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    if (!code) return;
    setCols(await api<PipelineColumn[]>(`/rec/jobs/${code}/pipeline`));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const move = async (app: ApplicationView, stage: string) => {
    setErr('');
    try {
      const reason =
        stage === 'rejected' ? (prompt('Rejection reason?') ?? undefined) : undefined;
      await api(`/rec/applications/${app.id}/stage`, {
        method: 'POST', body: JSON.stringify({ stage, reason }),
      });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const hire = async (app: ApplicationView) => {
    const staffNo = prompt('Staff number for new hire?');
    const postId = prompt('Post ID to fill?');
    if (!staffNo || !postId) return;
    try {
      const r = await api<{ staffNo: string }>('/rec/hire', {
        method: 'POST',
        body: JSON.stringify({
          applicationId: app.id,
          staffNo,
          postId,
        }),
      });
      setMsg(`Hired ${app.candidateName} as ${r.staffNo}.`);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Recruitment Pipeline
      </Typography>
      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <TextField size="small" label="Job code" value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()} />
        <Button onClick={load}>Load</Button>
      </Stack>
      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
        {cols.map((col) => (
          <Paper key={col.stage} variant="outlined"
            sx={{ minWidth: 260, p: 1.5, bgcolor: 'action.hover' }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <Typography fontWeight={600}>{col.stage}</Typography>
              <Chip size="small" label={col.count} />
            </Stack>
            <Stack spacing={1}>
              {col.items.map((a) => (
                <Paper key={a.id} sx={{ p: 1.5 }} variant="outlined">
                  <Typography fontWeight={600}>{a.candidateName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {a.candidateEmail}
                  </Typography>
                  {a.rejectionReason && (
                    <Typography variant="caption" color="error" display="block">
                      {a.rejectionReason}
                    </Typography>
                  )}
                  {col.stage === 'offer' && (
                    <Button size="small" sx={{ mt: 1 }} variant="contained"
                      onClick={() => hire(a)}>
                      Hire → PIM
                    </Button>
                  )}
                  {(NEXT_STAGES[col.stage] ?? []).length > 0 && (
                    <TextField
                      select size="small" sx={{ mt: 1, width: '100%' }}
                      label="Move to" value=""
                      onChange={(e) => move(a, e.target.value)}
                    >
                      {(NEXT_STAGES[col.stage] ?? []).map((s) => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                      ))}
                    </TextField>
                  )}
                </Paper>
              ))}
              {col.count === 0 && (
                <Typography variant="caption" color="text.secondary">—</Typography>
              )}
            </Stack>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
