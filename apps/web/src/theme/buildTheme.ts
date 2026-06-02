import { createTheme, Theme, alpha } from '@mui/material/styles';
import type { TenantBranding } from '@hrms/contracts';

/**
 * Builds an MUI theme that mirrors Google's Material 3 / Workspace design
 * language: pill-shaped buttons, tonal surfaces, soft-tinted selection pills
 * on navigation, Roboto / Google Sans typography, restrained elevation.
 *
 * Two hex values + a few flags re-skin the whole app — no rebuild.
 */
export function buildTheme(b: TenantBranding): Theme {
  const t = b.colorTone;
  const mode =
    t.mode === 'system'
      ? typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : t.mode;

  const isDark = mode === 'dark';

  // Material 3 surface tones. Light mode uses a faintly cool off-white; dark
  // mode uses the Google Workspace dark neutrals.
  const surface = isDark
    ? { default: '#1f1f1f', paper: '#2a2a2a' }
    : { default: '#f8fafd', paper: '#ffffff' };

  const surfaceVariant = isDark ? '#3a3a3a' : '#e7eaf0';
  const divider = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,64,67,0.12)';

  // M3 "secondary container" colour — the tonal pill behind selected nav
  // items, chips, FABs. Derived from primary so any tenant colour works.
  const tonalContainer = alpha(t.primary, isDark ? 0.24 : 0.14);
  const tonalContainerHover = alpha(t.primary, isDark ? 0.32 : 0.2);

  return createTheme({
    palette: {
      mode,
      primary: { main: t.primary, contrastText: '#ffffff' },
      secondary: { main: t.secondary },
      background: surface,
      divider,
      action: {
        hover: alpha(isDark ? '#ffffff' : '#3c4043', 0.06),
        selected: tonalContainer,
        focus: alpha(t.primary, 0.12),
      },
      text: isDark
        ? { primary: '#e8eaed', secondary: '#9aa0a6' }
        : { primary: '#202124', secondary: '#5f6368' }, // Google grey 900 / 700
    },
    shape: { borderRadius: t.radius },
    spacing: t.density === 'compact' ? 6 : 8,
    typography: {
      // Roboto Flex / Roboto mirror Google's product type stack. Tenants can
      // still override via branding.typography.fontFamily.
      fontFamily: `"Roboto Flex", ${b.typography.fontFamily}`,
      h4: { fontWeight: 500, letterSpacing: '-0.015em', fontSize: '2rem' },
      h5: { fontWeight: 500, letterSpacing: '-0.01em', fontSize: '1.5rem' },
      h6: { fontWeight: 500, letterSpacing: 0, fontSize: '1.125rem' },
      subtitle1: { fontWeight: 500 },
      subtitle2: { fontWeight: 500 },
      body1: { letterSpacing: '0.005em' },
      body2: { letterSpacing: '0.005em' },
      button: { textTransform: 'none', fontWeight: 500, letterSpacing: '0.005em' },
      caption: { letterSpacing: '0.02em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: surface.default,
            '-webkit-font-smoothing': 'antialiased',
            '-moz-osx-font-smoothing': 'grayscale',
          },
          '*::-webkit-scrollbar': { width: 12, height: 12 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: alpha(isDark ? '#ffffff' : '#202124', 0.16),
            borderRadius: 8,
            border: `3px solid ${surface.default}`,
          },
          '*::-webkit-scrollbar-thumb:hover': {
            backgroundColor: alpha(isDark ? '#ffffff' : '#202124', 0.28),
          },
        },
      },
      // ---- buttons: Google pill style ----
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 999,
            paddingInline: 22,
            paddingBlock: 8,
            minHeight: 38,
            fontWeight: 500,
          },
          containedPrimary: {
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none', backgroundColor: alpha(t.primary, 0.9) },
          },
          outlined: { borderColor: divider },
          text: { paddingInline: 14 },
          sizeSmall: { minHeight: 32, paddingInline: 16 },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            '&:hover': { backgroundColor: alpha(isDark ? '#ffffff' : '#3c4043', 0.08) },
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: { boxShadow: '0 1px 3px rgba(0,0,0,0.12)', borderRadius: 16 },
        },
      },

      // ---- surfaces ----
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: divider },
        },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: {
            borderRadius: 16,
            borderColor: divider,
            transition: 'border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease',
          },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'inherit' },
        styleOverrides: {
          root: {
            backgroundColor: surface.paper,
            borderBottom: `1px solid ${divider}`,
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: surface.paper,
            borderRight: `1px solid ${divider}`,
            backgroundImage: 'none',
          },
        },
      },
      MuiToolbar: {
        styleOverrides: { root: { minHeight: 64 } },
      },

      // ---- nav: tonal selected pill (the signature Google look) ----
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            paddingInline: 14,
            paddingBlock: 8,
            minHeight: 40,
            '&.Mui-selected': {
              backgroundColor: tonalContainer,
              color: t.primary,
              '& .MuiListItemIcon-root': { color: t.primary },
              '&:hover': { backgroundColor: tonalContainerHover },
            },
            '&:hover': {
              backgroundColor: alpha(isDark ? '#ffffff' : '#3c4043', 0.06),
            },
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: { root: { minWidth: 36, color: isDark ? '#9aa0a6' : '#5f6368' } },
      },

      // ---- inputs ----
      MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 8 },
          notchedOutline: { borderColor: divider },
        },
      },
      MuiInputLabel: {
        styleOverrides: { root: { fontWeight: 400 } },
      },

      // ---- chips: small pills ----
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 500, height: 26 },
          outlined: { borderColor: divider },
          colorPrimary: {
            backgroundColor: tonalContainer,
            color: t.primary,
            border: 'none',
          },
        },
      },

      // ---- tables / data grid ----
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 500,
            color: isDark ? '#9aa0a6' : '#5f6368',
            backgroundColor: 'transparent',
            borderBottom: `1px solid ${divider}`,
            fontSize: 13,
          },
          root: { borderBottom: `1px solid ${divider}`, fontSize: 14 },
        },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: divider } },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 4,
            fontSize: 12,
            backgroundColor: isDark ? '#3c4043' : '#3c4043',
            paddingInline: 10,
          },
        },
      },

      // ---- tabs: Google underline ----
      MuiTabs: {
        styleOverrides: {
          indicator: { height: 3, borderRadius: '3px 3px 0 0' },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            minHeight: 48,
            letterSpacing: '0.005em',
          },
        },
      },

      // ---- alerts ----
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 12, border: 'none' },
          standardError: { backgroundColor: alpha('#d93025', 0.08), color: '#d93025' },
          standardSuccess: { backgroundColor: alpha('#1e8e3e', 0.08), color: '#1e8e3e' },
          standardWarning: { backgroundColor: alpha('#f9ab00', 0.1), color: '#b06000' },
          standardInfo: { backgroundColor: tonalContainer, color: t.primary },
        },
      },

      // ---- avatars ----
      MuiAvatar: {
        styleOverrides: {
          root: { fontWeight: 500 },
        },
      },

      // ---- dialogs ----
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 28 },
        },
      },

      // ---- linear progress ----
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 999, height: 6, backgroundColor: surfaceVariant },
          bar: { borderRadius: 999 },
        },
      },

      // ---- switches: Material 3 style track ----
      MuiSwitch: {
        styleOverrides: {
          root: { padding: 8 },
          track: { borderRadius: 999, opacity: 1, backgroundColor: surfaceVariant },
        },
      },
    },
  });
}
