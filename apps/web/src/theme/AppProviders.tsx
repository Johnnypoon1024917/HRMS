'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import {
  DEFAULT_BRANDING,
  type ModuleManifest,
  type TenantBranding,
} from '@hrms/contracts';
import { buildTheme } from './buildTheme';
import { api, getToken } from '@/lib/api';
import { registerPwa } from '@/lib/pwa';

interface BootState {
  branding: TenantBranding;
  modules: ModuleManifest[];
  perms: Set<string>;
  refresh: () => void;
}

const Ctx = createContext<BootState | null>(null);
export const useBoot = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useBoot outside AppProviders');
  return c;
};

/**
 * Fetches per-tenant branding + enabled modules at boot and themes the app
 * accordingly. This is the heart of the white-label / modular behaviour:
 * everything below renders from tenant config, not build-time constants.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<TenantBranding>(DEFAULT_BRANDING);
  const [modules, setModules] = useState<ModuleManifest[]>([]);
  const [perms, setPerms] = useState<Set<string>>(new Set());

  const refresh = () => {
    if (!getToken()) return;
    api<{ branding: TenantBranding; modules: ModuleManifest[] }>(
      '/config/bootstrap',
    ).then((b) => {
      setBranding(b.branding);
      setModules(b.modules);
      // Perms are also derivable from the JWT; bootstrap keeps it simple.
      setPerms(new Set(b.modules.flatMap((m) => m.permissions)));
      if (typeof document !== 'undefined') document.title = b.branding.appName;
    });
  };

  useEffect(() => {
    registerPwa();
    refresh();
  }, []);

  const theme = useMemo(() => buildTheme(branding), [branding]);

  return (
    <Ctx.Provider value={{ branding, modules, perms, refresh }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </Ctx.Provider>
  );
}
