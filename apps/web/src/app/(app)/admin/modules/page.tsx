'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  Typography,
} from '@mui/material';
import { api } from '@/lib/api';
import { useBoot } from '@/theme/AppProviders';
import { Sym } from '@/components/Sym';

interface Row {
  key: string;
  nameKey: string;
  icon: string;
  core: boolean;
  dependsOn: string[];
  enabled: boolean;
}

/** Per-tenant module entitlement (Odoo-style apps on/off). Core = locked on. */
export default function ModulesAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const { refresh } = useBoot();

  const load = () => api<Row[]>('/config/modules').then(setRows);
  useEffect(() => { load(); }, []);

  const toggle = async (key: string, enabled: boolean) => {
    await api('/config/modules', {
      method: 'PUT',
      body: JSON.stringify({ moduleKey: key, enabled }),
    });
    await load();
    refresh(); // re-theme + rebuild nav immediately
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Modules
      </Typography>
      <Typography color="text.secondary" mb={2}>
        Enable or disable modules for this tenant. Disabled modules hide their
        navigation and their API returns 404.
      </Typography>
      <List>
        {rows.map((m) => (
          <ListItem
            key={m.key}
            divider
            secondaryAction={
              <Switch
                checked={m.enabled}
                disabled={m.core}
                onChange={(e) => toggle(m.key, e.target.checked)}
              />
            }
          >
            <ListItemIcon><Sym name={m.icon} /></ListItemIcon>
            <ListItemText
              primary={m.nameKey.split('.').pop()?.toUpperCase()}
              secondary={
                m.core
                  ? 'Core (always on)'
                  : m.dependsOn.length
                    ? `Depends on: ${m.dependsOn.join(', ')}`
                    : undefined
              }
            />
            {m.core && <Chip size="small" label="core" sx={{ mr: 2 }} />}
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
