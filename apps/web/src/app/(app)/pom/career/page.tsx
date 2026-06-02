'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { CareerEntry } from '@hrms/contracts';
import { api } from '@/lib/api';
import { Sym } from '@/components/Sym';

/** Staff career history — appointments + applied posting actions (UR-POM-003). */
export default function CareerHistoryPage() {
  const [staffId, setStaffId] = useState('');
  const [entries, setEntries] = useState<CareerEntry[] | null>(null);

  const load = async () => {
    if (!staffId) return;
    setEntries(await api<CareerEntry[]>(`/pom/career/${staffId}`));
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Career History
      </Typography>
      <Stack direction="row" spacing={2} mb={3}>
        <TextField size="small" label="Staff ID" value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()} />
        <Button variant="contained" onClick={load}>Load</Button>
      </Stack>

      {entries && entries.length === 0 && (
        <Typography color="text.secondary">No career records.</Typography>
      )}

      <Stack spacing={1.5}>
        {entries?.map((e, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Box sx={{ minWidth: 100, color: 'text.secondary', fontSize: 13 }}>
              {e.date}
            </Box>
            <Sym
              name={e.kind === 'action' ? 'sync_alt' : 'badge'}
              size={20}
            />
            <Box>
              <Typography fontWeight={600}>
                {e.rankCode || '—'}{' '}
                {e.postTitle && (
                  <Typography component="span" color="text.secondary">
                    · {e.postTitle}
                  </Typography>
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {e.detail}
                {e.orgUnitName ? ` · ${e.orgUnitName}` : ''}
                {e.effectiveTo ? ` · until ${e.effectiveTo}` : ''}
              </Typography>
            </Box>
            <Chip
              size="small"
              sx={{ ml: 'auto' }}
              label={e.kind}
              color={e.kind === 'action' ? 'primary' : 'default'}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
