import { z } from 'zod';

/**
 * Per-tenant white-label branding. Stored as JSON in
 * `public.tenant_branding.branding` and consumed by the web app's MUI
 * ThemeProvider at runtime — no rebuild needed to re-skin a tenant.
 */
export const ColorToneSchema = z.object({
  /** Seed colour; Material-3 tonal palette is derived from this. */
  primary: z.string().default('#1a73e8'), // Google blue
  secondary: z.string().default('#5f6368'),
  mode: z.enum(['light', 'dark', 'system']).default('light'),
  /** Shape roundness in px. */
  radius: z.number().min(0).max(28).default(12),
  density: z.enum(['comfortable', 'compact']).default('comfortable'),
});

export const TenantBrandingSchema = z.object({
  appName: z.string().default('People HRMS'),
  logoUrl: z.string().default('/brand/default/logo.svg'),
  faviconUrl: z.string().default('/favicon.ico'),
  colorTone: ColorToneSchema.default({}),
  typography: z
    .object({
      fontFamily: z.string().default('Roboto, system-ui, sans-serif'),
    })
    .default({}),
  icons: z
    .object({
      set: z.enum(['material-symbols', 'material-icons']).default('material-symbols'),
      /** moduleKey -> icon name override */
      overrides: z.record(z.string()).default({}),
    })
    .default({}),
  loginBackgroundUrl: z.string().optional(),
  supportEmail: z.string().email().optional(),
  locales: z.array(z.string()).default(['en', 'zh-Hant']),
  defaultLocale: z.string().default('en'),
});

export type ColorTone = z.infer<typeof ColorToneSchema>;
export type TenantBranding = z.infer<typeof TenantBrandingSchema>;

export const DEFAULT_BRANDING: TenantBranding = TenantBrandingSchema.parse({});
