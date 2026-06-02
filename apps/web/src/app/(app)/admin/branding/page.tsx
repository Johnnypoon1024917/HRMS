'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { api } from '@/lib/api';
import { useBoot } from '@/theme/AppProviders';

/**
 * Config Studio — white-label branding editor with live preview. Saving PUTs
 * the branding JSON; AppProviders.refresh() re-themes the running app with no
 * rebuild. Ships in both SaaS and on-prem.
 */
export default function BrandingStudio() {
  const { branding, refresh } = useBoot();
  const [b, setB] = useState(branding);
  const [saved, setSaved] = useState(false);

  const set = (path: string, value: unknown) => {
    setB((prev) => {
      const next = structuredClone(prev) as any;
      const keys = path.split('.');
      let o = next;
      for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
      o[keys.at(-1)!] = value;
      return next;
    });
    setSaved(false);
  };

  const save = async () => {
    await api('/config/branding', { method: 'PUT', body: JSON.stringify(b) });
    refresh();
    setSaved(true);
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Branding (Config Studio)
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Stack spacing={2}>
            <TextField label="App name" value={b.appName} onChange={(e) => set('appName', e.target.value)} />
            <TextField label="Logo URL" value={b.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} />
            <TextField label="Primary colour" value={b.colorTone.primary} onChange={(e) => set('colorTone.primary', e.target.value)} />
            <TextField label="Secondary colour" value={b.colorTone.secondary} onChange={(e) => set('colorTone.secondary', e.target.value)} />
            <TextField select label="Mode" value={b.colorTone.mode} onChange={(e) => set('colorTone.mode', e.target.value)}>
              {['light', 'dark', 'system'].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
            <TextField select label="Density" value={b.colorTone.density} onChange={(e) => set('colorTone.density', e.target.value)}>
              {['comfortable', 'compact'].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
            <Box>
              <Typography variant="body2">Corner radius: {b.colorTone.radius}px</Typography>
              <Slider min={0} max={28} value={b.colorTone.radius} onChange={(_, v) => set('colorTone.radius', v as number)} />
            </Box>
            <Button variant="contained" onClick={save}>
              {saved ? 'Saved ✓' : 'Save branding'}
            </Button>
          </Stack>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: b.colorTone.primary, color: '#fff' }}>
            <CardContent>
              <Typography variant="h6">{b.appName}</Typography>
              <Typography variant="body2">Live preview — primary tone</Typography>
              <Button sx={{ mt: 2, bgcolor: '#fff', color: b.colorTone.primary }} variant="contained">
                Sample button
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
