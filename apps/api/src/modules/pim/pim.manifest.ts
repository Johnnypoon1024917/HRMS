import { ModuleManifest } from '@hrms/contracts';

export const PIM_MANIFEST: ModuleManifest = {
  key: 'pim',
  nameKey: 'mod.pim',
  icon: 'badge',
  permissions: [
    'pim.read',
    'pim.write',
    'pim.read.restricted', // gates classification=restricted fields (UR-GEN-004)
    'pim.import',
    'pim.export',
  ],
  nav: [
    { path: '/pim/staff', labelKey: 'pim.nav.staff', icon: 'groups', perm: 'pim.read' },
    { path: '/pim/import', labelKey: 'pim.nav.import', icon: 'upload', perm: 'pim.import' },
  ],
};
