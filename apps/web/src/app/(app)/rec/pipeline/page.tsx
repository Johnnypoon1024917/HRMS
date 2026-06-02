'use client';

import { Suspense, useEffect, useState } from 'react';
import {
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
import type { ApplicationView, PipelineColumn } from '@hrms/contracts';
import { api } from '@/lib/api';
import { CrudDrawer } from '@/components/CrudDrawer';
import { StaffPicker } from '@/components/inputs/StaffPicker';
import { useNotify } from '@/components/feedback/Notify';
import { useDialogs } from '@/components/feedback/Confirm';

export const dynamic = 'force-dynamic'; // useSearchParams

const NEXT_STAGES: Record<string, string[]> = {
  applied: ['screened', 'rejected', 'withdrawn'],
  screened: ['interview', 'rejected', 'withdrawn'],
  interview: ['offer', 'rejected', 'withdrawn'],
  offer: ['rejected', 'withdrawn'], // 'hired' goes through /rec/hire
};

export default function PipelinePage() {
  return (
    <Suspense fallback={null}>
      <PipelineInner />
    </Suspense>
  );
}

function PipelineInner() {
  const params = useSearchParams();
  const notify = useNotify();
  const { prompt } = useDialogs();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [cols, setCols] = useState<PipelineColumn[]>([]);
  const [hireFor, setHireFor] = useState<ApplicationView | null>(null);
  const [hire, setHire] = useState({ staffNo: '', postId: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!code) return;
    try {
      setCols(await api<PipelineColumn[]>(`/rec/jobs/${code}/pipeline`));
    } catch (e: any) {
      notify.error(e.message);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const move = async (app: ApplicationView, stage: string) => {
    try {
      let reason: string | undefined;
      if (stage === 'rejected') {
        const r = await prompt({
          title: 'Reject application',
          label: 'Rejection reason',
          multiline: true,
          required: true,
          confirmLabel: 'Reject',
        });
        if (r === null) return;
        reason = r;
      }
      await api(`/rec/applications/${app.id}/stage`, {
        method: 'POST', body: JSON.stringify({ stage, reason }),
      });
      notify.success(`Moved to ${stage}`);
      load();
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  const submitHire = async () => {
    if (!hireFor) return;
    setSaving(true);
    try {
      const r = await api<{ staffNo: string }>('/rec/hire', {
        method: 'POST',
        body: JSON.stringify({
          applicationId: hireFor.id,
          staffNo: hire.staffNo,
          postId: hire.postId,
        }),
      });
      notify.success(`Hired ${hireFor.candidateName} as ${r.staffNo}`);
      setHireFor(null);
      load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
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
        <Button variant="contained" onClick={load}>Load</Button>
      </Stack>

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
                      onClick={() => { setHire({ staffNo: '', postId: '' }); setHireFor(a); }}>
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

      <CrudDrawer
        open={!!hireFor}
        title="Hire candidate"
        subtitle={hireFor?.candidateName}
        onClose={() => setHireFor(null)}
        onSubmit={submitHire}
        submitLabel="Hire"
        submitting={saving}
        submitDisabled={!hire.staffNo || !hire.postId}
      >
        <TextField label="New staff number" value={hire.staffNo} required
          onChange={(e) => setHire({ ...hire, staffNo: e.target.value })} />
        <TextField label="Post ID to fill" value={hire.postId} required
          onChange={(e) => setHire({ ...hire, postId: e.target.value })} />
      </CrudDrawer>
    </Box>
  );
}
