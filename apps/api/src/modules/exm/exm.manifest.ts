import { ModuleManifest } from '@hrms/contracts';

export const EXM_MANIFEST: ModuleManifest = {
  key: 'exm',
  nameKey: 'mod.exm',
  icon: 'exit_to_app',
  dependsOn: ['pim'],
  permissions: ['exm.read', 'exm.write'],
  nav: [
    { path: '/exm/exits', labelKey: 'exm.nav.exits', icon: 'exit_to_app', perm: 'exm.read' },
    { path: '/exm/forecast', labelKey: 'exm.nav.forecast', icon: 'event_upcoming', perm: 'exm.read' },
  ],
};
