'use client';

import { useState } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import type { CareerEntry } from '@hrms/contracts';
import { api } from '@/lib/api';
import { Sym } from '@/components/Sym';
import { PageHeader } from '@/components/PageHeader';
import { StaffPicker } from '@/components/inputs/StaffPicker';
import { useNotify } from '@/components/feedback/Notify';

/** Staff career history — appointments + applied posting actions (UR-POM-003). */
export default function CareerHistoryPage() {
  const notify = useNotify();
  const [staffId, setStaffId] = useState('');
  const [entries, setEntries] = useState<CareerEntry[] | null>(null);

  const load = async () => {
    if (!staffId) return;
    try {
      setEntries(await api<CareerEntry[]>(`/pom/career/${staffId}`));
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Career History"
        subtitle="Appointments and applied posting actions"
        primary={{ label: 'Load', icon: 'search', onClick: load, disabled: !staffId }}
      />

      <Stack direction="row" spacing={2} mb={3}>
        <StaffPicker
          value={staffId || null}
          onChange={(id) => setStaffId(id ?? '')}
          sx={{ minWidth: 320 }}
        />
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
