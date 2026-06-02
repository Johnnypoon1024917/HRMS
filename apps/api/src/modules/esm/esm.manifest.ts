import { ModuleManifest } from '@hrms/contracts';

export const ESM_MANIFEST: ModuleManifest = {
  key: 'esm',
  nameKey: 'mod.esm',
  icon: 'account_tree',
  permissions: ['esm.read', 'esm.write', 'esm.export'],
  dependsOn: ['pim'],
  nav: [
    { path: '/esm/org', labelKey: 'esm.nav.org', icon: 'account_tree', perm: 'esm.read' },
    { path: '/esm/posts', labelKey: 'esm.nav.posts', icon: 'work', perm: 'esm.read' },
    { path: '/esm/requests', labelKey: 'esm.nav.requests', icon: 'rule', perm: 'esm.write' },
    { path: '/esm/strength', labelKey: 'esm.nav.strength', icon: 'insights', perm: 'esm.read' },
  ],
};
