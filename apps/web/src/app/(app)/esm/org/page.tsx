'use client';

import { useEffect, useState } from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import type { OrgChartNode } from '@hrms/contracts';
import { api } from '@/lib/api';
import { Sym } from '@/components/Sym';
import { PageHeader } from '@/components/PageHeader';
import { useNotify } from '@/components/feedback/Notify';

function Node({ n, depth }: { n: OrgChartNode; depth: number }) {
  const vac = n.establishment - n.strength;
  return (
    <Box sx={{ ml: depth * 3 }}>
      <Paper variant="outlined" sx={{ p: 1.5, mb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Sym name={n.type === 'institution' ? 'domain' : 'account_tree'} />
        <Box sx={{ flexGrow: 1 }}>
          <Typography fontWeight={600}>
            {n.name} <Typography component="span" color="text.secondary">({n.code})</Typography>
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip size="small" label={`Est ${n.establishment}`} />
          <Chip size="small" color="success" label={`Str ${n.strength}`} />
          <Chip size="small" color={vac > 0 ? 'warning' : 'default'} label={`Vac ${vac}`} />
        </Stack>
      </Paper>
      {n.children.map((c) => (
        <Node key={c.id} n={c} depth={depth + 1} />
      ))}
    </Box>
  );
}

/** Org chart + Establishment & Strength figures (UR-ESM-003 / UR-ORM-001). */
export default function OrgPage() {
  const notify = useNotify();
  const [tree, setTree] = useState<OrgChartNode[]>([]);
  useEffect(() => {
    api<OrgChartNode[]>('/esm/org')
      .then(setTree)
      .catch((e: any) => notify.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Box>
      <PageHeader title="Organisation & Strength" />
      {tree.map((n) => (
        <Node key={n.id} n={n} depth={0} />
      ))}
    </Box>
  );
}
