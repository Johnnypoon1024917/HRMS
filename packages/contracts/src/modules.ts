/**
 * Module registry contract. Every feature module exports a ModuleManifest;
 * the platform uses it to build navigation, register RBAC permissions, and
 * enforce per-tenant enable/disable.
 */
export interface NavItem {
  path: string;
  /** i18n key, resolved client-side (bilingual EN / zh-Hant). */
  labelKey: string;
  icon: string;
  /** Permission required to see this nav entry. */
  perm: string;
}

export interface ModuleManifest {
  key: string;
  /** i18n key for the module display name. */
  nameKey: string;
  /** Default Material Symbols icon (overridable via tenant branding). */
  icon: string;
  /** All RBAC permissions this module defines, e.g. `pim.read`. */
  permissions: string[];
  nav: NavItem[];
  /** Other module keys this module needs enabled. */
  dependsOn?: string[];
  /** Core modules are always on and cannot be disabled per tenant. */
  core?: boolean;
}

/** Canonical module keys (extend as modules ship). */
export const MODULE_KEYS = [
  'identity',
  'rbac',
  'audit',
  'config',
  'pim',
  'esm',
  'hbm',
  'pem',
  'cdm',
  'ham',
  'trm',
  'pom',
  'exm',
  'lve',
  'rec',
  'pay',
  'ess',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
