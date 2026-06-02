import { ModuleManifest } from '@hrms/contracts';

export const HBM_MANIFEST: ModuleManifest = {
  key: 'hbm',
  nameKey: 'mod.hbm',
  icon: 'home',
  dependsOn: ['pim'],
  permissions: ['hbm.read', 'hbm.write', 'hbm.bill'],
  nav: [
    { path: '/hbm/types', labelKey: 'hbm.nav.types', icon: 'tune', perm: 'hbm.write' },
    { path: '/hbm/enrolments', labelKey: 'hbm.nav.enrolments', icon: 'home', perm: 'hbm.read' },
    { path: '/hbm/invoices', labelKey: 'hbm.nav.invoices', icon: 'receipt_long', perm: 'hbm.read' },
    { path: '/hbm/stats', labelKey: 'hbm.nav.stats', icon: 'insights', perm: 'hbm.read' },
  ],
};
