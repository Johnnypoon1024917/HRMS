import { ModuleManifest } from '@hrms/contracts';

export const TRM_MANIFEST: ModuleManifest = {
  key: 'trm',
  nameKey: 'mod.trm',
  icon: 'school',
  dependsOn: ['pim'],
  permissions: [
    'trm.read', // see own training records
    'trm.admin', // manage courses, sessions, call lists, completions
  ],
  nav: [
    { path: '/trm/calendar', labelKey: 'trm.nav.calendar', icon: 'event', perm: 'trm.read' },
    { path: '/trm/me', labelKey: 'trm.nav.me', icon: 'school', perm: 'trm.read' },
    { path: '/trm/courses', labelKey: 'trm.nav.courses', icon: 'menu_book', perm: 'trm.admin' },
    { path: '/trm/calls', labelKey: 'trm.nav.calls', icon: 'group_add', perm: 'trm.admin' },
  ],
};
