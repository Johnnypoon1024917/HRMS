import { ModuleManifest } from '@hrms/contracts';

export const CDM_MANIFEST: ModuleManifest = {
  key: 'cdm',
  nameKey: 'mod.cdm',
  icon: 'gavel',
  dependsOn: ['pim'],
  permissions: [
    'cdm.read',
    'cdm.write',
    /** Required to read restricted case content (UR-GEN-004 / classification). */
    'cdm.read.restricted',
  ],
  nav: [
    { path: '/cdm/cases', labelKey: 'cdm.nav.cases', icon: 'gavel', perm: 'cdm.read' },
  ],
};
