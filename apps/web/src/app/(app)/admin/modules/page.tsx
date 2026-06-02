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
} from '@mui/material';
import { api } from '@/lib/api';
import { useBoot } from '@/theme/AppProviders';
import { Sym } from '@/components/Sym';
import { PageHeader } from '@/components/PageHeader';
import { useNotify } from '@/components/feedback/Notify';

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
  const notify = useNotify();
  const [rows, setRows] = useState<Row[]>([]);
  const { refresh } = useBoot();

  const load = async () => {
    try {
      setRows(await api<Row[]>('/config/modules'));
    } catch (e: any) {
      notify.error(e.message);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (key: string, enabled: boolean) => {
    try {
      await api('/config/modules', {
        method: 'PUT',
        body: JSON.stringify({ moduleKey: key, enabled }),
      });
      await load();
      refresh(); // re-theme + rebuild nav immediately
      notify.success(enabled ? 'Module enabled' : 'Module disabled');
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Modules"
        subtitle="Enable or disable modules for this tenant. Disabled modules hide their navigation and their API returns 404."
      />
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
