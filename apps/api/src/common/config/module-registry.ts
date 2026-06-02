import { ModuleManifest } from '@hrms/contracts';
import { PIM_MANIFEST } from '../../modules/pim/pim.manifest';
import { ESM_MANIFEST } from '../../modules/esm/esm.manifest';
import { PAY_MANIFEST } from '../../modules/pay/pay.manifest';
import { LVE_MANIFEST } from '../../modules/lve/lve.manifest';
import { ESS_MANIFEST } from '../../modules/ess/ess.manifest';
import { POM_MANIFEST } from '../../modules/pom/pom.manifest';
import { PEM_MANIFEST } from '../../modules/pem/pem.manifest';
import { TRM_MANIFEST } from '../../modules/trm/trm.manifest';
import { HAM_MANIFEST } from '../../modules/ham/ham.manifest';
import { CDM_MANIFEST } from '../../modules/cdm/cdm.manifest';
import { EXM_MANIFEST } from '../../modules/exm/exm.manifest';
import { HBM_MANIFEST } from '../../modules/hbm/hbm.manifest';
import { REC_MANIFEST } from '../../modules/rec/rec.manifest';
import { BIL_MANIFEST } from '../../modules/bil/bil.manifest';

/** Core manifests (always on) + shipped feature manifests. */
export const CORE_MANIFESTS: ModuleManifest[] = [
  BIL_MANIFEST,
  {
    key: 'config',
    nameKey: 'mod.config',
    icon: 'tune',
    core: true,
    permissions: ['config.read', 'config.write'],
    nav: [
      { path: '/admin/branding', labelKey: 'nav.branding', icon: 'palette', perm: 'config.write' },
      { path: '/admin/modules', labelKey: 'nav.modules', icon: 'extension', perm: 'config.write' },
    ],
  },
  {
    key: 'audit',
    nameKey: 'mod.audit',
    icon: 'history',
    core: true,
    permissions: ['audit.read'],
    nav: [{ path: '/admin/audit', labelKey: 'nav.audit', icon: 'history', perm: 'audit.read' }],
  },
];

export const ALL_MANIFESTS: ModuleManifest[] = [
  ...CORE_MANIFESTS,
  PIM_MANIFEST,
  ESM_MANIFEST,
  PAY_MANIFEST,
  LVE_MANIFEST,
  ESS_MANIFEST,
  POM_MANIFEST,
  PEM_MANIFEST,
  TRM_MANIFEST,
  HAM_MANIFEST,
  CDM_MANIFEST,
  EXM_MANIFEST,
  HBM_MANIFEST,
  REC_MANIFEST,
];

export function manifest(key: string): ModuleManifest | undefined {
  return ALL_MANIFESTS.find((m) => m.key === key);
}

/** Flattened list of every permission the platform knows about. */
export const ALL_PERMISSIONS = [
  ...new Set(ALL_MANIFESTS.flatMap((m) => m.permissions)),
];
