'use client';

import { useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Collapse,
  Drawer,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { usePathname, useRouter } from 'next/navigation';
import { useBoot } from '@/theme/AppProviders';
import { Sym } from './Sym';
import { clearToken } from '@/lib/api';

const DRAWER_W = 272;

/** Friendly labels for nav segments. The labelKey is `<mod>.nav.<seg>`. */
const NAV_LABELS: Record<string, string> = {
  'ess.me': 'My profile',
  'lve.me': 'My leave',
  'pem.me': 'My reviews',
  'trm.me': 'My training',
  'esm.org': 'Org chart',
  'esm.posts': 'Posts',
  'esm.requests': 'Change requests',
  'esm.strength': 'Strength',
  'pim.staff': 'Staff directory',
  'pim.import': 'Import staff',
  'pay.runs': 'Pay runs',
  'pay.calendar': 'Calendar',
  'pay.holidays': 'Public holidays',
  'pay.timesheets': 'Timesheets',
  'pay.components': 'Components',
  'pay.profiles': 'Pay profiles',
  'pay.loans': 'Loans',
  'pay.terminations': 'Final settlement',
  'pay.ir56': 'IR56 returns',
  'pay.constants': 'Constants',
  'lve.approvals': 'Approvals',
  'lve.types': 'Leave types',
  'pem.appraise': 'Appraise team',
  'pem.cycles': 'Cycles',
  'trm.calendar': 'Calendar',
  'trm.courses': 'Courses',
  'trm.calls': 'Call lists',
  'ham.awards': 'Awards',
  'ham.lsi': 'Long-service',
  'ham.types': 'Award types',
  'hbm.types': 'Benefit types',
  'hbm.enrolments': 'Enrolments',
  'hbm.invoices': 'Invoices',
  'hbm.stats': 'Stats',
  'cdm.cases': 'Cases',
  'exm.exits': 'Exits',
  'exm.forecast': 'Forecast',
  'rec.jobs': 'Jobs',
  'rec.pipeline': 'Pipeline',
  'rec.candidates': 'Candidates',
  'pom.actions': 'Actions',
  'pom.career': 'Career',
  'pom.acting': 'Acting',
  'bil.subscription': 'Subscription',
  'bil.plans': 'Plans',
  'bil.licenses': 'Licenses',
  'ess.team': 'My team',
};

/** Sidebar section grouping. */
const GROUPS: Array<{ id: string; title: string; modules: string[] }> = [
  { id: 'people',  title: 'People',             modules: ['pim', 'esm', 'ess'] },
  { id: 'work',    title: 'Work',               modules: ['lve', 'pay', 'pom'] },
  { id: 'growth',  title: 'Growth',             modules: ['pem', 'trm', 'rec'] },
  { id: 'rewards', title: 'Rewards & welfare',  modules: ['ham', 'hbm'] },
  { id: 'cases',   title: 'Cases & exits',      modules: ['cdm', 'exm'] },
  { id: 'admin',   title: 'Administration',     modules: ['bil'] },
];

const labelFor = (labelKey: string): string => {
  const parts = labelKey.split('.');
  const mod = parts[0];
  const seg = parts[parts.length - 1];
  return (
    NAV_LABELS[`${mod}.${seg}`] ??
    NAV_LABELS[seg] ??
    seg.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { branding, modules, perms } = useBoot();
  const router = useRouter();
  const path = usePathname();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const moduleNav = useMemo(() => {
    return modules
      .map((m) => ({
        key: m.key,
        icon: branding.icons.overrides[m.key] ?? m.icon,
        items: m.nav
          .filter((n) => perms.has(n.perm))
          .map((n) => ({ ...n, label: labelFor(n.labelKey) })),
      }))
      .filter((m) => m.items.length > 0);
  }, [modules, perms, branding.icons.overrides]);

  const grouped = useMemo(() => {
    const byKey = new Map(moduleNav.map((m) => [m.key, m]));
    const used = new Set<string>();
    const result = GROUPS.map((g) => ({
      ...g,
      modules: g.modules.flatMap((k) => {
        const m = byKey.get(k);
        if (!m) return [];
        used.add(k);
        return [m];
      }),
    })).filter((g) => g.modules.length > 0);
    const leftover = moduleNav.filter((m) => !used.has(m.key));
    if (leftover.length) result.push({ id: 'more', title: 'More', modules: leftover });
    return result;
  }, [moduleNav]);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const goto = (p: string) => {
    router.push(p);
    if (mobile) setOpen(false);
  };

  const userInitial = 'U';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Google-style top bar: white surface, no border shadow, Workspace-style search pill */}
      <AppBar
        position="fixed"
        sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}
      >
        <Toolbar sx={{ gap: 2, minHeight: 64 }}>
          <IconButton
            edge="start"
            onClick={() => setOpen((v) => !v)}
            sx={{ display: mobile ? 'inline-flex' : 'inline-flex', color: 'text.secondary' }}
          >
            <Sym name="menu" />
          </IconButton>

          <Box
            onClick={() => router.push('/dashboard')}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={branding.logoUrl}
              alt=""
              height={28}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <Typography sx={{ fontWeight: 500, fontSize: 20, color: 'text.primary' }}>
              {branding.appName}
            </Typography>
          </Box>

          <Box
            sx={{
              flexGrow: 1,
              maxWidth: 720,
              ml: { xs: 1, md: 4 },
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 1,
              px: 2,
              height: 46,
              borderRadius: 999,
              bgcolor: theme.palette.mode === 'dark'
                ? alpha('#ffffff', 0.06)
                : '#eaf1fb',
              transition: 'background-color 150ms ease',
              '&:hover': {
                bgcolor: theme.palette.mode === 'dark'
                  ? alpha('#ffffff', 0.1)
                  : '#e1eaf7',
              },
            }}
          >
            <Sym name="search" size={20} />
            <InputBase
              placeholder="Search people, leave, payroll…"
              sx={{ flexGrow: 1, fontSize: 15 }}
            />
          </Box>

          <Box sx={{ flexGrow: 1, display: { md: 'none' } }} />

          <Tooltip title="Help">
            <IconButton sx={{ color: 'text.secondary' }}>
              <Sym name="help_outline" size={22} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Notifications">
            <IconButton sx={{ color: 'text.secondary' }}>
              <Sym name="notifications" size={22} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Sign out">
            <Avatar
              sx={{
                width: 34,
                height: 34,
                cursor: 'pointer',
                ml: 0.5,
                bgcolor: alpha(theme.palette.primary.main, 0.14),
                color: 'primary.main',
                fontSize: 15,
                fontWeight: 500,
              }}
              onClick={() => {
                clearToken();
                router.push('/login');
              }}
            >
              {userInitial}
            </Avatar>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={mobile ? 'temporary' : 'permanent'}
        open={mobile ? open : true}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: DRAWER_W,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_W },
        }}
      >
        <Toolbar />
        <Box sx={{ overflowY: 'auto', pt: 1.5, pb: 3, px: 1.5 }}>
          {grouped.map((g) => {
            const isCollapsed = collapsed.has(g.id);
            return (
              <Box key={g.id} sx={{ mb: 1 }}>
                <ListSubheader
                  disableSticky
                  onClick={() => toggle(g.id)}
                  sx={{
                    cursor: 'pointer',
                    lineHeight: '36px',
                    px: 2,
                    bgcolor: 'transparent',
                    color: 'text.secondary',
                    fontSize: 12,
                    fontWeight: 500,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none',
                    '&:hover': { color: 'text.primary' },
                  }}
                >
                  {g.title}
                  <Sym
                    name={isCollapsed ? 'chevron_right' : 'expand_more'}
                    size={18}
                  />
                </ListSubheader>
                <Collapse in={!isCollapsed} timeout="auto" unmountOnExit>
                  <List dense disablePadding>
                    {g.modules.map((m) =>
                      m.items.map((n) => {
                        const active = path === n.path || path.startsWith(n.path + '/');
                        return (
                          <ListItemButton
                            key={n.path}
                            onClick={() => goto(n.path)}
                            selected={active}
                            sx={{ mb: 0.25 }}
                          >
                            <ListItemIcon>
                              <Sym name={n.icon} size={20} filled={active} />
                            </ListItemIcon>
                            <ListItemText
                              primary={n.label}
                              primaryTypographyProps={{
                                fontSize: 14,
                                fontWeight: active ? 500 : 400,
                              }}
                            />
                          </ListItemButton>
                        );
                      }),
                    )}
                  </List>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 4 },
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
