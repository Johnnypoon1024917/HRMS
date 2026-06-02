import { ModuleManifest } from '@hrms/contracts';

export const POM_MANIFEST: ModuleManifest = {
  key: 'pom',
  nameKey: 'mod.pom',
  icon: 'sync_alt',
  dependsOn: ['pim', 'esm'],
  permissions: ['pom.read', 'pom.write'],
  nav: [
    { path: '/pom/actions', labelKey: 'pom.nav.actions', icon: 'sync_alt', perm: 'pom.read' },
    { path: '/pom/career', labelKey: 'pom.nav.career', icon: 'timeline', perm: 'pom.read' },
    { path: '/pom/acting', labelKey: 'pom.nav.acting', icon: 'badge', perm: 'pom.read' },
  ],
};
