import { ModuleManifest } from '@hrms/contracts';

export const LVE_MANIFEST: ModuleManifest = {
  key: 'lve',
  nameKey: 'mod.lve',
  icon: 'event_available',
  dependsOn: ['pim'],
  permissions: [
    'lve.read', // see own leave
    'lve.request', // submit own leave
    'lve.approve', // approve team leave (manager)
    'lve.admin', // maintain leave types / ledger
  ],
  nav: [
    { path: '/lve/me', labelKey: 'lve.nav.me', icon: 'event_available', perm: 'lve.read' },
    { path: '/lve/approvals', labelKey: 'lve.nav.approvals', icon: 'fact_check', perm: 'lve.approve' },
    { path: '/lve/types', labelKey: 'lve.nav.types', icon: 'tune', perm: 'lve.admin' },
  ],
};
