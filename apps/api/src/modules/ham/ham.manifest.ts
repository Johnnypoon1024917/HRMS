import { ModuleManifest } from '@hrms/contracts';

export const HAM_MANIFEST: ModuleManifest = {
  key: 'ham',
  nameKey: 'mod.ham',
  icon: 'workspace_premium',
  dependsOn: ['pim'],
  permissions: ['ham.read', 'ham.write'],
  nav: [
    { path: '/ham/awards', labelKey: 'ham.nav.awards', icon: 'workspace_premium', perm: 'ham.read' },
    { path: '/ham/lsi', labelKey: 'ham.nav.lsi', icon: 'history_toggle_off', perm: 'ham.write' },
    { path: '/ham/types', labelKey: 'ham.nav.types', icon: 'tune', perm: 'ham.write' },
  ],
};
